namespace LXTA_Native.Models;

public sealed record DownloadItem(string Id, string FileName, string FilePath, string Status, long Downloaded, long Total, string? Url)
{
    public double Progress => Total > 0 ? Math.Clamp((double)Downloaded / Total, 0, 1) : 0;
    public string ProgressText => Total > 0 ? $"{Downloaded / 1024d / 1024d:0.0} / {Total / 1024d / 1024d:0.0} MB" : Status;
}
