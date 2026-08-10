using Microsoft.Data.Sqlite;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class LibraryService
{
    private readonly SettingsService settingsService;

    public LibraryService(SettingsService settingsService)
    {
        this.settingsService = settingsService;
    }

    public async Task<IReadOnlyList<PlaylistSummary>> LoadPlaylistsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await settingsService.LoadAsync(cancellationToken);
        if (!File.Exists(settings.DataRoot)) return Array.Empty<PlaylistSummary>();
        await using var connection = OpenReadOnly(settings.DataRoot);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT l.id, l.name, l.source, l.position,
                   (SELECT COUNT(*) FROM my_list_music_info m WHERE m.listId = l.id) AS trackCount
            FROM my_list l ORDER BY l.position ASC
            """;
        var result = new List<PlaylistSummary>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new PlaylistSummary(reader.GetString(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2), reader.GetInt32(3), reader.GetInt32(4)));
        }
        return result;
    }

    public async Task<IReadOnlyList<Track>> LoadTracksAsync(string? playlistId = null, string? search = null, CancellationToken cancellationToken = default)
    {
        var settings = await settingsService.LoadAsync(cancellationToken);
        if (!File.Exists(settings.DataRoot)) return Array.Empty<Track>();
        await using var connection = OpenReadOnly(settings.DataRoot);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT m.id, m.name, m.singer, m.source, m.interval, m.meta
            FROM my_list_music_info m
            LEFT JOIN my_list_music_info_order o ON o.listId=m.listId AND o.musicInfoId=m.id
            WHERE ($playlist IS NULL OR m.listId = $playlist)
              AND ($search IS NULL OR m.name LIKE $pattern OR m.singer LIKE $pattern)
            ORDER BY CASE WHEN $playlist IS NULL THEN m.rowid END DESC,
                     CASE WHEN $playlist IS NOT NULL THEN COALESCE(o."order", m.rowid) END ASC
            LIMIT 1000
            """;
        command.Parameters.AddWithValue("$playlist", (object?)playlistId ?? DBNull.Value);
        command.Parameters.AddWithValue("$search", (object?)search ?? DBNull.Value);
        command.Parameters.AddWithValue("$pattern", $"%{search}%");
        var result = new List<Track>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(Track.FromDatabase(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.IsDBNull(4) ? "" : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5)));
        }
        return result;
    }

    public async Task<IReadOnlyList<DownloadItem>> LoadDownloadsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await settingsService.LoadAsync(cancellationToken);
        if (!File.Exists(settings.DataRoot)) return Array.Empty<DownloadItem>();
        await using var connection = OpenReadOnly(settings.DataRoot);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, fileName, filePath, statusText, progress_downloaded, progress_total, url
            FROM download_list ORDER BY position ASC LIMIT 500
            """;
        var result = new List<DownloadItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new DownloadItem(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt64(4), reader.GetInt64(5), reader.IsDBNull(6) ? null : reader.GetString(6)));
        }
        return result;
    }

    private static SqliteConnection OpenReadOnly(string path) => new(new SqliteConnectionStringBuilder
    {
        DataSource = path,
        Mode = SqliteOpenMode.ReadOnly,
        Cache = SqliteCacheMode.Shared,
        Pooling = false,
    }.ToString());
}
