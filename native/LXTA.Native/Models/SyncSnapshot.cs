namespace LXTA_Native.Models;

public sealed record SyncSnapshot(DateTimeOffset CreatedAt, IReadOnlyList<SyncPlaylist> Playlists, string? DislikeData = null);
public sealed record SyncPlaylist(PlaylistSummary Summary, IReadOnlyList<Track> Tracks);
public sealed record SyncServerStatus(bool Running, string Mode, int Port, string Endpoint, string Message);
