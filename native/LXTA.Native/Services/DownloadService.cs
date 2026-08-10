using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class DownloadService
{
    private readonly HttpClient client = new() { Timeout = TimeSpan.FromMinutes(30) };

    public async Task<DownloadItem> ResumeAsync(DownloadItem item, IProgress<double>? progress = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(item.Url)) return item with { Status = "等待音源地址" };
        Directory.CreateDirectory(Path.GetDirectoryName(item.FilePath) ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "LX-TA"));
        var existing = File.Exists(item.FilePath) ? new FileInfo(item.FilePath).Length : 0;
        using var request = new HttpRequestMessage(HttpMethod.Get, item.Url);
        if (existing > 0) request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(existing, null);
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        var total = existing + (response.Content.Headers.ContentLength ?? 0);
        await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
        await using var target = new FileStream(item.FilePath, existing > 0 ? FileMode.Append : FileMode.Create, FileAccess.Write, FileShare.Read, 128 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
        var buffer = new byte[128 * 1024];
        long completed = existing;
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            completed += read;
            progress?.Report(total > 0 ? (double)completed / total : 0);
        }
        return item with { Status = "下载完成", Downloaded = completed, Total = total };
    }
}
