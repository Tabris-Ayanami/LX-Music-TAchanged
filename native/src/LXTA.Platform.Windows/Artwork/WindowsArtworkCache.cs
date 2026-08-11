using System.Security.Cryptography;
using System.Text;
using LXTA.Application.Abstractions;
using LXTA.Domain.Library;
using Windows.Storage;
using Windows.Storage.FileProperties;
using Windows.Storage.Streams;

namespace LXTA.Platform.Windows.Artwork;

public sealed class WindowsArtworkCache(IAppPaths paths) : IArtworkCache
{
    public async Task<Uri?> GetOrCreateAsync(
        LocalTrack track,
        CancellationToken cancellationToken = default)
    {
        if (!track.IsAvailable || string.IsNullOrWhiteSpace(track.FilePath)) return null;

        cancellationToken.ThrowIfCancellationRequested();
        var mediaFile = new FileInfo(track.FilePath);
        var sidecar = FindSidecar(mediaFile);
        var fingerprint = sidecar is null
            ? $"{mediaFile.FullName.ToUpperInvariant()}|{mediaFile.Length}|{mediaFile.LastWriteTimeUtc.Ticks}"
            : $"{mediaFile.FullName.ToUpperInvariant()}|{mediaFile.Length}|{mediaFile.LastWriteTimeUtc.Ticks}|{sidecar.FullName.ToUpperInvariant()}|{sidecar.Length}|{sidecar.LastWriteTimeUtc.Ticks}";
        var cacheKey = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(fingerprint)));

        if (sidecar is not null)
        {
            var sidecarExtension = sidecar.Extension.Equals(".png", StringComparison.OrdinalIgnoreCase) ? ".png" : ".jpg";
            var sidecarCachePath = Path.Combine(paths.ArtworkCacheRoot, $"{cacheKey}{sidecarExtension}");
            if (!File.Exists(sidecarCachePath))
            {
                await using var source = new FileStream(sidecar.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                await using var target = new FileStream(sidecarCachePath, FileMode.CreateNew, FileAccess.Write, FileShare.Read);
                await source.CopyToAsync(target, cancellationToken).ConfigureAwait(false);
            }
            return new Uri(sidecarCachePath);
        }

        var thumbnailCachePath = Path.Combine(paths.ArtworkCacheRoot, $"{cacheKey}.jpg");
        if (File.Exists(thumbnailCachePath)) return new Uri(thumbnailCachePath);

        try
        {
            var storageFile = await StorageFile.GetFileFromPathAsync(mediaFile.FullName);
            using var thumbnail = await storageFile.GetThumbnailAsync(
                ThumbnailMode.MusicView,
                320,
                ThumbnailOptions.ResizeThumbnail);
            if (thumbnail is null || thumbnail.Size == 0 || thumbnail.Type == ThumbnailType.Icon) return null;

            var cacheFolder = await StorageFolder.GetFolderFromPathAsync(paths.ArtworkCacheRoot);
            var cacheFile = await cacheFolder.CreateFileAsync(
                Path.GetFileName(thumbnailCachePath),
                CreationCollisionOption.ReplaceExisting);
            using var output = await cacheFile.OpenAsync(FileAccessMode.ReadWrite);
            await RandomAccessStream.CopyAsync(thumbnail, output);
            await output.FlushAsync();
            return new Uri(thumbnailCachePath);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return null;
        }
    }

    private static FileInfo? FindSidecar(FileInfo mediaFile)
    {
        var directory = mediaFile.DirectoryName;
        if (directory is null) return null;

        foreach (var extension in new[] { ".jpg", ".png" })
        {
            var path = Path.Combine(directory, Path.GetFileNameWithoutExtension(mediaFile.Name) + extension);
            if (File.Exists(path)) return new FileInfo(path);
        }

        return null;
    }
}
