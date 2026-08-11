namespace LXTA.Domain.Library;

public enum LibraryView
{
    Tracks,
    Albums,
    Artists,
}

public enum TrackAvailabilityFilter
{
    All,
    Available,
    Missing,
}

public enum TrackSort
{
    Original,
    Title,
    Artist,
    Album,
    Duration,
}

public enum LocalGroupKind
{
    Album,
    Artist,
}

public sealed record LocalLibraryGroup(
    LocalGroupKind Kind,
    string Key,
    string Title,
    string Subtitle,
    IReadOnlyList<LocalTrack> Tracks,
    LocalTrack ArtworkSource)
{
    public int TrackCount => Tracks.Count;
}

public sealed record LocalLibrarySnapshot(
    string SourceDatabasePath,
    DateTimeOffset LoadedAt,
    IReadOnlyList<LocalTrack> Tracks);
