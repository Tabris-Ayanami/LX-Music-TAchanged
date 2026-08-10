using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class UserApiService : IAsyncDisposable
{
    private readonly SettingsService settings;
    private readonly string storePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "LX-TA", "LxDatas", "user_api.json");
    private readonly ConcurrentDictionary<string, TaskCompletionSource<JsonElement>> requests = new();
    private readonly object writeGate = new();
    private Process? process;
    private TaskCompletionSource<bool>? ready;
    private string? selectedId;

    public UserApiService(SettingsService settings) => this.settings = settings;
    public event EventHandler<string>? StatusChanged;
    public bool IsRunning => process is { HasExited: false };
    public string? SelectedId => selectedId;

    public async Task<IReadOnlyList<UserApiInfo>> GetApisAsync(CancellationToken cancellationToken = default)
    {
        var root = await ReadRootAsync(cancellationToken);
        return (root["userApis"] as JsonArray)?.OfType<JsonObject>().Select(ToInfo).ToArray() ?? Array.Empty<UserApiInfo>();
    }

    public async Task<UserApiInfo?> ImportAsync(string script, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(script)) return null;
        var header = ParseHeader(script); var root = await ReadRootAsync(cancellationToken);
        var list = root["userApis"] as JsonArray ?? new JsonArray(); root["userApis"] = list;
        var id = $"user_api_{Random.Shared.Next(100, 999)}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        list.Add(new JsonObject { ["id"] = id, ["name"] = header.Name, ["description"] = header.Description, ["version"] = header.Version, ["author"] = header.Author, ["homepage"] = header.Homepage, ["allowShowUpdateAlert"] = true, ["script"] = "gz_" + Convert.ToBase64String(Deflate(Encoding.UTF8.GetBytes(script))) });
        await WriteRootAsync(root, cancellationToken); return new UserApiInfo(id, header.Name, header.Description, header.Version, header.Author, header.Homepage, true);
    }

    public async Task RemoveAsync(IEnumerable<string> ids, CancellationToken cancellationToken = default)
    {
        var remove = ids.ToHashSet(StringComparer.Ordinal); var root = await ReadRootAsync(cancellationToken);
        if (root["userApis"] is JsonArray list) for (var index = list.Count - 1; index >= 0; index--) if (list[index] is JsonObject item && remove.Contains(item["id"]?.GetValue<string>() ?? "")) list.RemoveAt(index);
        await WriteRootAsync(root, cancellationToken); if (selectedId is not null && remove.Contains(selectedId)) await StopAsync();
    }

    public async Task SelectAsync(string id, CancellationToken cancellationToken = default)
    {
        if (selectedId == id && IsRunning) return;
        var root = await ReadRootAsync(cancellationToken); var item = (root["userApis"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault(x => x["id"]?.GetValue<string>() == id);
        if (item is null) throw new InvalidOperationException("音源脚本不存在");
        await StopAsync(); var script = await InflateScriptAsync(item["script"]?.GetValue<string>() ?? "", cancellationToken); var host = Path.Combine(AppContext.BaseDirectory, "Assets", "user-api-host.mjs");
        var bundledNode = Path.Combine(AppContext.BaseDirectory, "Runtime", "node.exe");
        process = new Process { StartInfo = new ProcessStartInfo { FileName = File.Exists(bundledNode) ? bundledNode : "node", Arguments = $"\"{host}\"", UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true } };
        process.OutputDataReceived += Process_OutputDataReceived; process.ErrorDataReceived += (_, args) => { if (!string.IsNullOrWhiteSpace(args.Data)) StatusChanged?.Invoke(this, args.Data); }; process.Exited += (_, _) => StatusChanged?.Invoke(this, "音源脚本进程已退出");
        if (!process.Start()) throw new InvalidOperationException("无法启动音源脚本运行时");
        process.BeginOutputReadLine(); process.BeginErrorReadLine(); ready = new(TaskCreationOptions.RunContinuationsAsynchronously); selectedId = id;
        Send(new { type = "init", script, info = new { id, name = item["name"]?.GetValue<string>() ?? id, description = item["description"]?.GetValue<string>() ?? "", version = item["version"]?.GetValue<string>() ?? "", author = item["author"]?.GetValue<string>() ?? "", homepage = item["homepage"]?.GetValue<string>() ?? "" } });
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); timeout.CancelAfter(TimeSpan.FromSeconds(25)); await ready.Task.WaitAsync(timeout.Token); StatusChanged?.Invoke(this, "音源脚本已就绪");
    }

    public async Task<UserApiRequestResult?> RequestAsync(string source, string action, object info, CancellationToken cancellationToken = default)
    {
        if (!IsRunning || selectedId is null) throw new InvalidOperationException("尚未选择音源脚本");
        var requestId = Guid.NewGuid().ToString("N"); var completion = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously); requests[requestId] = completion; Send(new { type = "request", requestId, source, action, info });
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); timeout.CancelAfter(TimeSpan.FromSeconds(20)); return new UserApiRequestResult(source, action, await completion.Task.WaitAsync(timeout.Token));
    }

    public async Task SetAllowShowUpdateAlertAsync(string id, bool enabled, CancellationToken cancellationToken = default)
    {
        var root = await ReadRootAsync(cancellationToken); var item = (root["userApis"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault(x => x["id"]?.GetValue<string>() == id); if (item is null) return; item["allowShowUpdateAlert"] = enabled; await WriteRootAsync(root, cancellationToken);
    }

    private void Process_OutputDataReceived(object sender, DataReceivedEventArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Data)) return;
        try { using var doc = JsonDocument.Parse(args.Data); var root = doc.RootElement; var type = root.GetProperty("type").GetString(); if (type == "ready") ready?.TrySetResult(true); else if (type == "inited") StatusChanged?.Invoke(this, "音源脚本已连接"); else if (type == "result" && root.TryGetProperty("requestId", out var id) && requests.TryRemove(id.GetString()!, out var completion)) completion.TrySetResult(root.GetProperty("result")); else if (type == "error") { var message = root.GetProperty("message").GetString() ?? "脚本错误"; if (root.TryGetProperty("requestId", out var errorId) && requests.TryRemove(errorId.GetString()!, out var failed)) failed.TrySetException(new InvalidOperationException(message)); else ready?.TrySetException(new InvalidOperationException(message)); } }
        catch (Exception ex) { StatusChanged?.Invoke(this, $"音源脚本输出无效：{ex.Message}"); }
    }

    private void Send(object value) { lock (writeGate) { if (process is { HasExited: false }) { process.StandardInput.WriteLine(JsonSerializer.Serialize(value)); process.StandardInput.Flush(); } } }
    private async Task StopAsync() { if (process is null) return; try { if (!process.HasExited) process.Kill(true); } catch { } await process.WaitForExitAsync(); process.Dispose(); process = null; selectedId = null; foreach (var request in requests.Values) request.TrySetCanceled(); requests.Clear(); }
    private async Task<JsonObject> ReadRootAsync(CancellationToken cancellationToken) { if (!File.Exists(storePath)) return new JsonObject { ["userApis"] = new JsonArray() }; await using var stream = File.OpenRead(storePath); return await JsonNode.ParseAsync(stream, cancellationToken: cancellationToken) as JsonObject ?? new JsonObject { ["userApis"] = new JsonArray() }; }
    private async Task WriteRootAsync(JsonObject root, CancellationToken cancellationToken) { Directory.CreateDirectory(Path.GetDirectoryName(storePath)!); await File.WriteAllTextAsync(storePath, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }), cancellationToken); }
    private static UserApiInfo ToInfo(JsonObject item) => new(item["id"]?.GetValue<string>() ?? "", item["name"]?.GetValue<string>() ?? "", item["description"]?.GetValue<string>() ?? "", item["version"]?.GetValue<string>() ?? "", item["author"]?.GetValue<string>() ?? "", item["homepage"]?.GetValue<string>() ?? "", item["allowShowUpdateAlert"]?.GetValue<bool>() ?? false);
    private static (string Name, string Description, string Version, string Author, string Homepage) ParseHeader(string script) { var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); foreach (var line in script.Split('\n').Take(32)) { var match = System.Text.RegularExpressions.Regex.Match(line, @"^\s?\*\s?@(\w+)\s+(.+)$"); if (match.Success) values[match.Groups[1].Value] = match.Groups[2].Value.Trim(); } return (values.GetValueOrDefault("name", "未命名音源"), values.GetValueOrDefault("description", ""), values.GetValueOrDefault("version", ""), values.GetValueOrDefault("author", ""), values.GetValueOrDefault("homepage", "")); }
    private static byte[] Deflate(byte[] data) { using var output = new MemoryStream(); using (var stream = new ZLibStream(output, CompressionLevel.Optimal, true)) stream.Write(data); return output.ToArray(); }
    private static async Task<string> InflateScriptAsync(string value, CancellationToken cancellationToken) { if (!value.StartsWith("gz_", StringComparison.Ordinal)) return value; await using var input = new MemoryStream(Convert.FromBase64String(value[3..])); await using var stream = new ZLibStream(input, CompressionMode.Decompress); using var reader = new StreamReader(stream, Encoding.UTF8); return await reader.ReadToEndAsync(cancellationToken); }
    public async ValueTask DisposeAsync() => await StopAsync();
}
