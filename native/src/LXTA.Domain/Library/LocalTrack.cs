namespace LXTA.Domain.Library;

public sealed record LocalTrack(
    string Id,
    int OriginalOrder,
    string Title,
    string Artist,
    string Album,
    string Duration,
    string FilePath,
    string Extension,
    string? ArtworkHint,
    bool IsAvailable)
{
    public int DisplayOrder => OriginalOrder + 1;

    public string DisplayArtist => string.IsNullOrWhiteSpace(Artist) ? "未知音乐家" : Artist;

    public string DisplayAlbum => string.IsNullOrWhiteSpace(Album) ? "未命名专辑" : Album;

    public string FileStatus => IsAvailable ? "可用" : "缺失";
}
