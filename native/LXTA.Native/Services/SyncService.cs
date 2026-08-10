using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class SyncService : IAsyncDisposable
{
    private readonly SettingsService settings;
    private readonly LibraryService library;
    private readonly LibraryWriteService writer;
    private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(15) };
    private HttpListener? listener;
    private CancellationTokenSource? serverCancellation;
    private string authToken = string.Empty;

    public SyncService(SettingsService settings, LibraryService library, LibraryWriteService writer) { this.settings = settings; this.library = library; this.writer = writer; }
    public event EventHandler<SyncServerStatus>? StatusChanged;
    public SyncServerStatus Status { get; private set; } = new(false, "server", 23332, "", "未启动");

    public async Task<SyncServerStatus> StartServerAsync(int port, CancellationToken cancellationToken = default)
    {
        if (listener is not null) return Status;
        authToken = await LoadOrCreateTokenAsync(cancellationToken);
        listener = new HttpListener(); listener.Prefixes.Add($"http://127.0.0.1:{port}/lxsync/");
        try { listener.Start(); }
        catch (HttpListenerException ex) { listener = null; return SetStatus(new(false, "server", port, "", $"同步服务启动失败：{ex.Message}")); }
        serverCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _ = Task.Run(() => AcceptLoopAsync(listener, serverCancellation.Token));
        return SetStatus(new(true, "server", port, $"http://127.0.0.1:{port}/lxsync/", "同步服务已启动"));
    }

    public async Task StopServerAsync()
    {
        serverCancellation?.Cancel(); serverCancellation?.Dispose(); serverCancellation = null;
        listener?.Stop(); listener?.Close(); listener = null;
        SetStatus(new(false, "server", Status.Port, "", "同步服务已停止")); await Task.CompletedTask;
    }

    public async Task<SyncSnapshot?> PullAsync(string endpoint, string token, CancellationToken cancellationToken = default)
    {
        var url = endpoint.TrimEnd('/') + "/snapshot"; using var request = new HttpRequestMessage(HttpMethod.Get, url); request.Headers.Add("X-LX-Sync-Token", token);
        using var response = await http.SendAsync(request, cancellationToken); if (!response.IsSuccessStatusCode) return null; return await response.Content.ReadFromJsonAsync<SyncSnapshot>(cancellationToken: cancellationToken);
    }

    public async Task<bool> PushAsync(string endpoint, string token, SyncSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint.TrimEnd('/') + "/snapshot") { Content = JsonContent.Create(snapshot) }; request.Headers.Add("X-LX-Sync-Token", token);
        using var response = await http.SendAsync(request, cancellationToken); return response.IsSuccessStatusCode;
    }

    public async Task<SyncSnapshot> CreateSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var playlists = await library.LoadPlaylistsAsync(cancellationToken); var result = new List<SyncPlaylist>();
        foreach (var playlist in playlists) result.Add(new SyncPlaylist(playlist, await library.LoadTracksAsync(playlist.Id, cancellationToken: cancellationToken)));
        return new SyncSnapshot(DateTimeOffset.UtcNow, result);
    }

    public async Task ApplySnapshotAsync(SyncSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        var local = (await library.LoadPlaylistsAsync(cancellationToken)).ToDictionary(item => item.Id, StringComparer.Ordinal);
        foreach (var remote in snapshot.Playlists)
        {
            var targetId = remote.Summary.Id;
            if (local.TryGetValue(targetId, out var existing))
            {
                if (!string.Equals(existing.Name, remote.Summary.Name, StringComparison.Ordinal)) await writer.RenamePlaylistAsync(targetId, remote.Summary.Name, cancellationToken);
            }
            else
            {
                var created = await writer.CreatePlaylistAsync(remote.Summary.Name, cancellationToken); if (created is null) continue; targetId = created.Id;
            }
            await writer.AddTracksAsync(targetId, remote.Tracks, cancellationToken);
        }
    }

    public string GenerateToken() => authToken;

    private async Task AcceptLoopAsync(HttpListener target, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            HttpListenerContext context;
            try { context = await target.GetContextAsync().WaitAsync(cancellationToken); } catch { break; }
            _ = Task.Run(() => HandleRequestAsync(context), cancellationToken);
        }
    }

    private async Task HandleRequestAsync(HttpListenerContext context)
    {
        try
        {
            if (context.Request.Headers["X-LX-Sync-Token"] != authToken) { context.Response.StatusCode = 401; context.Response.Close(); return; }
            if (context.Request.HttpMethod == "GET" && context.Request.Url?.AbsolutePath.EndsWith("/snapshot", StringComparison.OrdinalIgnoreCase) == true)
            {
                var snapshot = await CreateSnapshotAsync(); await JsonSerializer.SerializeAsync(context.Response.OutputStream, snapshot); context.Response.ContentType = "application/json";
            }
            else if (context.Request.HttpMethod == "POST" && context.Request.Url?.AbsolutePath.EndsWith("/snapshot", StringComparison.OrdinalIgnoreCase) == true)
            {
                var snapshot = await JsonSerializer.DeserializeAsync<SyncSnapshot>(context.Request.InputStream);
                if (snapshot is null) { context.Response.StatusCode = 400; } else { await ApplySnapshotAsync(snapshot); context.Response.StatusCode = 202; }
            }
            else context.Response.StatusCode = 404;
        }
        catch { context.Response.StatusCode = 500; }
        finally { context.Response.Close(); }
    }

    private async Task<string> LoadOrCreateTokenAsync(CancellationToken cancellationToken)
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "LX-TA", "NativeData"); Directory.CreateDirectory(root); var path = Path.Combine(root, "sync-token.txt");
        if (File.Exists(path)) return (await File.ReadAllTextAsync(path, cancellationToken)).Trim();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant(); await File.WriteAllTextAsync(path, token, cancellationToken); return token;
    }
    private SyncServerStatus SetStatus(SyncServerStatus status) { Status = status; StatusChanged?.Invoke(this, status); return status; }
    public async ValueTask DisposeAsync() { await StopServerAsync(); http.Dispose(); }
}
