using System.Text.Json;
using LXTA.Application.Abstractions;
using LXTA.Domain.Library;
using Microsoft.Data.Sqlite;

namespace LXTA.Storage.Legacy;

public sealed class SqliteLegacyLibraryReader(IAppPaths paths) : ILocalLibraryReader
{
    public const string LocalMusicListId = "userlist_local_music";

    public async Task<LocalLibrarySnapshot> ReadAsync(CancellationToken cancellationToken = default)
    {
        var databasePath = Path.GetFullPath(paths.LegacyDatabasePath);
        if (!File.Exists(databasePath))
        {
            throw new LegacyLibraryException($"未找到 Electron 本地曲库：{databasePath}");
        }

        try
        {
            var connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = databasePath,
                Mode = SqliteOpenMode.ReadOnly,
                Cache = SqliteCacheMode.Private,
                Pooling = false,
            }.ToString();

            await using var connection = new SqliteConnection(connectionString);
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

            await AssertCompatibleSchemaAsync(connection, cancellationToken).ConfigureAwait(false);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT mInfo."id", mInfo."name", mInfo."singer", mInfo."source",
                       mInfo."interval", mInfo."meta", COALESCE(orderInfo."order", 2147483647)
                FROM "my_list_music_info" AS mInfo
                LEFT JOIN "my_list_music_info_order" AS orderInfo
                  ON mInfo."id" = orderInfo."musicInfoId" AND orderInfo."listId" = $listId
                WHERE mInfo."listId" = $listId AND mInfo."source" = 'local'
                ORDER BY COALESCE(orderInfo."order", 2147483647), mInfo."rowid"
                """;
            command.Parameters.AddWithValue("$listId", LocalMusicListId);

            var tracks = new List<LocalTrack>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                cancellationToken.ThrowIfCancellationRequested();
                tracks.Add(ReadTrack(reader, tracks.Count));
            }

            return new LocalLibrarySnapshot(databasePath, DateTimeOffset.Now, tracks);
        }
        catch (LegacyLibraryException)
        {
            throw;
        }
        catch (SqliteException exception)
        {
            throw new LegacyLibraryException(
                $"无法以只读方式打开 Electron 本地曲库：{databasePath}",
                exception);
        }
    }

    private static async Task AssertCompatibleSchemaAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COUNT(*)
            FROM sqlite_master
            WHERE type = 'table'
              AND name IN ('my_list_music_info', 'my_list_music_info_order')
            """;
        var count = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false));
        if (count != 2)
        {
            throw new LegacyLibraryException("Electron 数据库缺少本地曲库所需的数据表；Native 未修改该数据库。");
        }
    }

    private static LocalTrack ReadTrack(SqliteDataReader reader, int fallbackOrder)
    {
        var id = reader.GetString(0);
        var title = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
        var artist = reader.IsDBNull(2) ? string.Empty : reader.GetString(2);
        var duration = reader.IsDBNull(4) ? "--:--" : reader.GetString(4);
        var metaJson = reader.IsDBNull(5) ? "{}" : reader.GetString(5);
        var order = reader.IsDBNull(6) ? fallbackOrder : reader.GetInt32(6);

        string filePath = string.Empty;
        string album = string.Empty;
        string extension = string.Empty;
        string? artworkHint = null;

        try
        {
            using var document = JsonDocument.Parse(metaJson);
            var root = document.RootElement;
            filePath = GetString(root, "filePath") ?? string.Empty;
            album = GetString(root, "albumName") ?? string.Empty;
            extension = GetString(root, "ext") ?? Path.GetExtension(filePath).TrimStart('.');
            artworkHint = GetString(root, "picUrl");
        }
        catch (JsonException)
        {
            // Preserve the row as a visible unavailable item. A malformed metadata row
            // must not make the rest of a read-only library disappear.
        }

        return new LocalTrack(
            id,
            order,
            string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(filePath) : title,
            artist,
            album,
            duration,
            filePath,
            extension,
            artworkHint,
            !string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath));
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
}
