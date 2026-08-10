using System.Net.Http.Headers;
using System.Text.Json;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class UpdateService
{
    private const string CurrentVersion = "2.0.1-native";
    private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(12) };
    public async Task<UpdateInfo?> CheckAsync(CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/repos/Tabris-Ayanami/LX-Music-TAchanged/releases/latest"); request.Headers.UserAgent.Add(new ProductInfoHeaderValue("LXTA-Native", CurrentVersion));
        using var response = await http.SendAsync(request, cancellationToken); if (!response.IsSuccessStatusCode) return null; using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken)); var root = document.RootElement;
        var version = root.TryGetProperty("tag_name", out var tag) ? tag.GetString() ?? "" : ""; var url = root.TryGetProperty("html_url", out var html) ? html.GetString() ?? "" : ""; var notes = root.TryGetProperty("body", out var body) ? body.GetString() ?? "" : "";
        return new UpdateInfo(version, url, notes, IsNewer(version));
    }
    private static bool IsNewer(string value)
    {
        var normalized = value.TrimStart('v', 'V').Split('-', 2)[0]; return Version.TryParse(normalized, out var remote) && Version.TryParse(CurrentVersion.Split('-', 2)[0], out var current) && remote > current;
    }
}
