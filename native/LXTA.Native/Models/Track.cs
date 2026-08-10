using System.Text.Json;

namespace LXTA_Native.Models;

public sealed record Track(
    string Id,
    string Name,
    string Singer,
    string Source,
    string Duration,
    string? FilePath,
    string? AlbumName,
    string? PictureUrl,
    string? RawMeta = null)
{
    public string DisplayTitle => string.IsNullOrWhiteSpace(Singer) ? Name : $"{Name} · {Singer}";
    public string? OnlineId
    {
        get
        {
            if (string.IsNullOrWhiteSpace(RawMeta)) return null;
            try
            {
                var json = JsonDocument.Parse(RawMeta).RootElement;
                foreach (var key in new[] { "songmid", "songId", "id" }) if (json.TryGetProperty(key, out var value)) return value.GetString();
            }
            catch (JsonException) { }
            return null;
        }
    }

    public static Track FromDatabase(string id, string name, string singer, string source, string duration, string? meta)
    {
        string? filePath = null;
        string? albumName = null;
        string? pictureUrl = null;
        if (!string.IsNullOrWhiteSpace(meta))
        {
            try
            {
                var json = JsonDocument.Parse(meta).RootElement;
                filePath = json.TryGetProperty("filePath", out var path) ? path.GetString() : null;
                albumName = json.TryGetProperty("albumName", out var album) ? album.GetString() : null;
                pictureUrl = json.TryGetProperty("picUrl", out var picture) ? picture.GetString() : null;
            }
            catch (JsonException)
            {
                // Older records may contain non-JSON metadata. The track remains usable.
            }
        }
        return new Track(id, name, singer, source, duration, filePath, albumName, pictureUrl, meta);
    }
}
