namespace LXTA_Native.Models;

public sealed record PlaylistSummary(string Id, string Name, string? Source, int Position, int TrackCount)
{
    public string TrackCountText => TrackCount == 1 ? "1 首歌曲" : $"{TrackCount} 首歌曲";
}
