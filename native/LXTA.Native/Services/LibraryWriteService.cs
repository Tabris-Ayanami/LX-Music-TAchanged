using Microsoft.Data.Sqlite;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class LibraryWriteService
{
    private readonly SettingsService settings;

    public LibraryWriteService(SettingsService settings) => this.settings = settings;

    public async Task<PlaylistSummary?> CreatePlaylistAsync(string name, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        if (!File.Exists(path) || string.IsNullOrWhiteSpace(name)) return null;
        var id = $"native_{Guid.NewGuid():N}";
        await using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite, Cache = SqliteCacheMode.Shared, Pooling = false }.ToString());
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO my_list (id, name, source, sourceListId, position, locationUpdateTime) VALUES ($id, $name, NULL, NULL, COALESCE((SELECT MAX(position) + 1 FROM my_list), 0), $time)";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", name.Trim());
        command.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        await command.ExecuteNonQueryAsync(cancellationToken);
        return new PlaylistSummary(id, name.Trim(), null, 0, 0);
    }

    public async Task RenamePlaylistAsync(string id, string name, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        if (!File.Exists(path) || string.IsNullOrWhiteSpace(name)) return;
        await using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite, Pooling = false }.ToString());
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE my_list SET name=$name, locationUpdateTime=$time WHERE id=$id";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", name.Trim());
        command.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task DeletePlaylistAsync(string id, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        if (!File.Exists(path) || id == "userlist_local_music") return;
        await using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite, Pooling = false }.ToString());
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);
        foreach (var sql in new[] { "DELETE FROM my_list_music_info_order WHERE listId=$id", "DELETE FROM my_list_music_info WHERE listId=$id", "DELETE FROM my_list WHERE id=$id" })
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.Parameters.AddWithValue("$id", id);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task AddTracksAsync(string playlistId, IEnumerable<Track> tracks, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        var items = tracks.GroupBy(track => track.Id).Select(group => group.First()).ToArray();
        if (!File.Exists(path) || items.Length == 0) return;
        await using var connection = await OpenWriteAsync(path, cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);
        var nextOrder = await GetNextOrderAsync(connection, transaction, playlistId, cancellationToken);
        foreach (var track in items)
        {
            await using var info = connection.CreateCommand();
            info.Transaction = transaction;
            info.CommandText = "INSERT OR IGNORE INTO my_list_music_info (id,listId,name,singer,source,interval,meta) VALUES ($id,$list,$name,$singer,$source,$interval,$meta)";
            info.Parameters.AddWithValue("$id", track.Id);
            info.Parameters.AddWithValue("$list", playlistId);
            info.Parameters.AddWithValue("$name", track.Name);
            info.Parameters.AddWithValue("$singer", track.Singer);
            info.Parameters.AddWithValue("$source", track.Source);
            info.Parameters.AddWithValue("$interval", track.Duration);
            info.Parameters.AddWithValue("$meta", track.RawMeta ?? "{}");
            if (await info.ExecuteNonQueryAsync(cancellationToken) == 0) continue;
            await using var order = connection.CreateCommand();
            order.Transaction = transaction;
            order.CommandText = "INSERT INTO my_list_music_info_order (listId,musicInfoId,\"order\") VALUES ($list,$id,$order)";
            order.Parameters.AddWithValue("$list", playlistId);
            order.Parameters.AddWithValue("$id", track.Id);
            order.Parameters.AddWithValue("$order", nextOrder++);
            await order.ExecuteNonQueryAsync(cancellationToken);
        }
        await TouchPlaylistAsync(connection, transaction, playlistId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<int> ImportFolderAsync(string folder, CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(folder)) return 0;
        var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp3", ".flac", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".wma" };
        var tracks = Directory.EnumerateFiles(folder, "*.*", SearchOption.AllDirectories)
            .Where(path => extensions.Contains(Path.GetExtension(path)))
            .Select(path =>
            {
                var bytes = SHA1.HashData(Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToLowerInvariant()));
                var id = "local_" + Convert.ToHexString(bytes).ToLowerInvariant();
                var name = Path.GetFileNameWithoutExtension(path);
                return new Track(id, name, "", "local", "", path, "", "", JsonSerializer.Serialize(new { filePath = path, songId = path, ext = Path.GetExtension(path).TrimStart('.') }));
            }).ToArray();
        await AddTracksAsync("userlist_local_music", tracks, cancellationToken);
        return tracks.Length;
    }

    public async Task RemoveTracksAsync(string playlistId, IEnumerable<string> trackIds, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        var ids = trackIds.Distinct().ToArray();
        if (!File.Exists(path) || ids.Length == 0 || playlistId == "userlist_local_music") return;
        await using var connection = await OpenWriteAsync(path, cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);
        foreach (var id in ids)
        {
            foreach (var sql in new[]
            {
                "DELETE FROM my_list_music_info_order WHERE listId=$list AND musicInfoId=$id",
                "DELETE FROM my_list_music_info WHERE listId=$list AND id=$id",
            })
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = sql;
                command.Parameters.AddWithValue("$list", playlistId);
                command.Parameters.AddWithValue("$id", id);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
        await NormalizeOrderAsync(connection, transaction, playlistId, cancellationToken);
        await TouchPlaylistAsync(connection, transaction, playlistId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task MoveTracksAsync(string fromPlaylistId, string toPlaylistId, IEnumerable<Track> tracks, CancellationToken cancellationToken = default)
    {
        var items = tracks.ToArray();
        await AddTracksAsync(toPlaylistId, items, cancellationToken);
        await RemoveTracksAsync(fromPlaylistId, items.Select(track => track.Id), cancellationToken);
    }

    public async Task ReorderTracksAsync(string playlistId, IReadOnlyList<string> orderedIds, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        if (!File.Exists(path)) return;
        await using var connection = await OpenWriteAsync(path, cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);
        for (var index = 0; index < orderedIds.Count; index++)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "UPDATE my_list_music_info_order SET \"order\"=$order WHERE listId=$list AND musicInfoId=$id";
            command.Parameters.AddWithValue("$order", index);
            command.Parameters.AddWithValue("$list", playlistId);
            command.Parameters.AddWithValue("$id", orderedIds[index]);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await TouchPlaylistAsync(connection, transaction, playlistId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<SqliteConnection> OpenWriteAsync(string path, CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite, Cache = SqliteCacheMode.Shared, Pooling = false }.ToString());
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static async Task<int> GetNextOrderAsync(SqliteConnection connection, SqliteTransaction transaction, string playlistId, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT COALESCE(MAX(\"order\") + 1, 0) FROM my_list_music_info_order WHERE listId=$list";
        command.Parameters.AddWithValue("$list", playlistId);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    private static async Task NormalizeOrderAsync(SqliteConnection connection, SqliteTransaction transaction, string playlistId, CancellationToken cancellationToken)
    {
        await using var query = connection.CreateCommand();
        query.Transaction = transaction;
        query.CommandText = "SELECT musicInfoId FROM my_list_music_info_order WHERE listId=$list ORDER BY \"order\"";
        query.Parameters.AddWithValue("$list", playlistId);
        var ids = new List<string>();
        await using (var reader = await query.ExecuteReaderAsync(cancellationToken)) while (await reader.ReadAsync(cancellationToken)) ids.Add(reader.GetString(0));
        for (var index = 0; index < ids.Count; index++)
        {
            await using var update = connection.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = "UPDATE my_list_music_info_order SET \"order\"=$order WHERE listId=$list AND musicInfoId=$id";
            update.Parameters.AddWithValue("$order", index);
            update.Parameters.AddWithValue("$list", playlistId);
            update.Parameters.AddWithValue("$id", ids[index]);
            await update.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task TouchPlaylistAsync(SqliteConnection connection, SqliteTransaction transaction, string playlistId, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "UPDATE my_list SET locationUpdateTime=$time WHERE id=$id";
        command.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        command.Parameters.AddWithValue("$id", playlistId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
