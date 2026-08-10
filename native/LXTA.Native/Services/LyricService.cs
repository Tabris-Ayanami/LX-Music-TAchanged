using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class LyricService
{
    private static readonly Regex Timestamp = new("\\[(?<m>\\d{1,3}):(?<s>\\d{2})(?:\\.(?<ms>\\d{1,3}))?\\]", RegexOptions.Compiled);
    private readonly SettingsService settings;

    public LyricService(SettingsService settings) => this.settings = settings;

    public async Task<IReadOnlyList<LyricLine>> LoadAsync(string id, string source, CancellationToken cancellationToken = default)
    {
        var path = (await settings.LoadAsync(cancellationToken)).DataRoot;
        if (!File.Exists(path)) return Array.Empty<LyricLine>();
        await using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString());
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT type, text FROM lyric WHERE id=$id AND source=$source ORDER BY type";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$source", source);
        var layers = new Dictionary<string, List<LyricLine>>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var type = reader.IsDBNull(0) ? "lyric" : reader.GetString(0); var raw = reader.IsDBNull(1) ? null : reader.GetString(1);
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var lines = new List<LyricLine>();
            foreach (var line in raw.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                var matches = Timestamp.Matches(line); var text = Timestamp.Replace(line, string.Empty).Trim();
                foreach (Match match in matches)
                {
                    var milliseconds = match.Groups["ms"].Success ? int.Parse(match.Groups["ms"].Value.PadRight(3, '0')) : 0;
                    lines.Add(new LyricLine(TimeSpan.FromMinutes(int.Parse(match.Groups["m"].Value)) + TimeSpan.FromSeconds(int.Parse(match.Groups["s"].Value)) + TimeSpan.FromMilliseconds(milliseconds), text));
                }
            }
            layers[type] = lines;
        }
        var main = layers.TryGetValue("lyric", out var lyric) ? lyric : layers.Values.FirstOrDefault() ?? new List<LyricLine>();
        var translation = layers.FirstOrDefault(item => item.Key.Contains("tlyric", StringComparison.OrdinalIgnoreCase) || item.Key.Contains("trans", StringComparison.OrdinalIgnoreCase)).Value ?? new List<LyricLine>();
        var roman = layers.FirstOrDefault(item => item.Key.Contains("rlyric", StringComparison.OrdinalIgnoreCase) || item.Key.Contains("roman", StringComparison.OrdinalIgnoreCase)).Value ?? new List<LyricLine>();
        return main.OrderBy(x => x.Time).Select(line =>
        {
            var translated = translation.OrderBy(item => Math.Abs((item.Time - line.Time).TotalMilliseconds)).FirstOrDefault(item => Math.Abs((item.Time - line.Time).TotalMilliseconds) < 500)?.Text;
            var romanized = roman.OrderBy(item => Math.Abs((item.Time - line.Time).TotalMilliseconds)).FirstOrDefault(item => Math.Abs((item.Time - line.Time).TotalMilliseconds) < 500)?.Text;
            return translated is null && romanized is null ? line : line with { Translation = string.Join("  ", new[] { translated, romanized }.Where(text => !string.IsNullOrWhiteSpace(text))) };
        }).ToArray();
    }
}
