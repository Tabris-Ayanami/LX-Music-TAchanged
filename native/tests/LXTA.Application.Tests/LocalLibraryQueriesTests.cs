using LXTA.Application.Library;
using LXTA.Domain.Library;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace LXTA.Application.Tests;

[TestClass]
public sealed class LocalLibraryQueriesTests
{
    [TestMethod]
    public void Apply_SearchesTitleArtistAlbumAndFileName()
    {
        var tracks = new[]
        {
            Track(0, "Scarborough Fair", "山田タマル", "青い記忆", @"E:\Music\001.flac"),
            Track(1, "City", "羽肿", "City", @"E:\Music\002.mp3"),
        };

        var byArtist = LocalLibraryQueries.Apply(tracks, new("山田", TrackAvailabilityFilter.All, TrackSort.Original));
        var byAlbum = LocalLibraryQueries.Apply(tracks, new("City", TrackAvailabilityFilter.All, TrackSort.Original));
        var byFileName = LocalLibraryQueries.Apply(tracks, new("002", TrackAvailabilityFilter.All, TrackSort.Original));

        Assert.AreEqual("Scarborough Fair", byArtist.Single().Title);
        Assert.AreEqual("City", byAlbum.Single().Title);
        Assert.AreEqual("City", byFileName.Single().Title);
    }

    [TestMethod]
    public void Apply_FiltersAvailabilityAndSortsWithoutMutatingInput()
    {
        var tracks = new[]
        {
            Track(2, "Zulu", "B", "Two", "missing.flac", false),
            Track(1, "Alpha", "A", "One", "alpha.flac"),
        };

        var result = LocalLibraryQueries.Apply(tracks, new("", TrackAvailabilityFilter.Available, TrackSort.Title));

        Assert.AreEqual(1, result.Count);
        Assert.AreEqual("Alpha", result[0].Title);
        Assert.AreEqual("Zulu", tracks[0].Title);
    }

    [TestMethod]
    public void Groups_MatchElectronAlbumAndArtistKeys()
    {
        var tracks = new[]
        {
            Track(0, "A", "Singer", "Album", "a.flac"),
            Track(1, "B", "Singer", "Album", "b.flac"),
            Track(2, "C", "Singer", "Other", "c.flac"),
        };

        var albums = LocalLibraryQueries.BuildAlbumGroups(tracks);
        var artists = LocalLibraryQueries.BuildArtistGroups(tracks);

        Assert.AreEqual(2, albums.Count);
        Assert.AreEqual(1, artists.Count);
        Assert.AreEqual(3, artists[0].TrackCount);
        Assert.AreEqual("2 张专辑", artists[0].Subtitle);
    }

    [TestMethod]
    public void Apply_HandlesFiftyThousandTracks()
    {
        var tracks = Enumerable.Range(0, 50_000)
            .Select(index => Track(index, $"Track {index:D5}", $"Artist {index % 100}", $"Album {index % 500}", $"{index}.flac"))
            .ToArray();

        var result = LocalLibraryQueries.Apply(tracks, new("Artist 42", TrackAvailabilityFilter.All, TrackSort.Album));

        Assert.AreEqual(500, result.Count);
        Assert.IsTrue(result.All(track => track.Artist == "Artist 42"));
    }

    private static LocalTrack Track(
        int order,
        string title,
        string artist,
        string album,
        string filePath,
        bool available = true) =>
        new($"id-{order}", order, title, artist, album, "03:30", filePath, "flac", null, available);
}
