using System.Globalization;
using LXTA.Domain.Library;

namespace LXTA.Application.Library;

public sealed record LocalLibraryQuery(
    string SearchText,
    TrackAvailabilityFilter Availability,
    TrackSort Sort);

public static class LocalLibraryQueries
{
    public static IReadOnlyList<LocalTrack> Apply(
        IReadOnlyList<LocalTrack> tracks,
        LocalLibraryQuery query)
    {
        var searchText = query.SearchText.Trim();
        IEnumerable<LocalTrack> result = tracks;

        result = query.Availability switch
        {
            TrackAvailabilityFilter.Available => result.Where(track => track.IsAvailable),
            TrackAvailabilityFilter.Missing => result.Where(track => !track.IsAvailable),
            _ => result,
        };

        if (searchText.Length > 0)
        {
            result = result.Where(track =>
                Contains(track.Title, searchText) ||
                Contains(track.Artist, searchText) ||
                Contains(track.Album, searchText) ||
                Contains(Path.GetFileName(track.FilePath), searchText));
        }

        result = query.Sort switch
        {
            TrackSort.Title => result.OrderBy(track => track.Title, NaturalTextComparer.Instance)
                .ThenBy(track => track.Artist, NaturalTextComparer.Instance),
            TrackSort.Artist => result.OrderBy(track => track.DisplayArtist, NaturalTextComparer.Instance)
                .ThenBy(track => track.Title, NaturalTextComparer.Instance),
            TrackSort.Album => result.OrderBy(track => track.DisplayAlbum, NaturalTextComparer.Instance)
                .ThenBy(track => track.OriginalOrder),
            TrackSort.Duration => result.OrderBy(track => ParseDuration(track.Duration))
                .ThenBy(track => track.Title, NaturalTextComparer.Instance),
            _ => result.OrderBy(track => track.OriginalOrder),
        };

        return result.ToArray();
    }

    public static IReadOnlyList<LocalLibraryGroup> BuildAlbumGroups(IReadOnlyList<LocalTrack> tracks) =>
        tracks
            .GroupBy(track => $"{track.DisplayAlbum}\u001f{track.DisplayArtist}", StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var items = group.OrderBy(track => track.OriginalOrder).ToArray();
                var first = items[0];
                return new LocalLibraryGroup(
                    LocalGroupKind.Album,
                    group.Key,
                    first.DisplayAlbum,
                    first.DisplayArtist,
                    items,
                    items.FirstOrDefault(HasArtworkHint) ?? first);
            })
            .OrderBy(group => group.Title, NaturalTextComparer.Instance)
            .ToArray();

    public static IReadOnlyList<LocalLibraryGroup> BuildArtistGroups(IReadOnlyList<LocalTrack> tracks) =>
        tracks
            .GroupBy(track => track.DisplayArtist, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var items = group.OrderBy(track => track.DisplayAlbum, NaturalTextComparer.Instance)
                    .ThenBy(track => track.OriginalOrder)
                    .ToArray();
                var albumCount = items.Select(track => track.DisplayAlbum)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Count();
                return new LocalLibraryGroup(
                    LocalGroupKind.Artist,
                    group.Key,
                    group.Key,
                    $"{albumCount} 张专辑",
                    items,
                    items.FirstOrDefault(HasArtworkHint) ?? items[0]);
            })
            .OrderBy(group => group.Title, NaturalTextComparer.Instance)
            .ToArray();

    private static bool Contains(string? value, string query) =>
        !string.IsNullOrWhiteSpace(value) &&
        CultureInfo.CurrentCulture.CompareInfo.IndexOf(value, query, CompareOptions.IgnoreCase) >= 0;

    private static bool HasArtworkHint(LocalTrack track) => !string.IsNullOrWhiteSpace(track.ArtworkHint);

    private static TimeSpan ParseDuration(string duration) =>
        TimeSpan.TryParseExact(duration, ["m\\:ss", "mm\\:ss", "h\\:mm\\:ss"], CultureInfo.InvariantCulture, out var value)
            ? value
            : TimeSpan.MaxValue;

    private sealed class NaturalTextComparer : IComparer<string>
    {
        public static NaturalTextComparer Instance { get; } = new();

        public int Compare(string? left, string? right) =>
            StringComparer.CurrentCultureIgnoreCase.Compare(left, right);
    }
}
