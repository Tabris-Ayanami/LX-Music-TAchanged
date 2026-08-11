using LXTA.Domain.Library;

namespace LXTA.Application.Abstractions;

public interface ILocalLibraryReader
{
    Task<LocalLibrarySnapshot> ReadAsync(CancellationToken cancellationToken = default);
}

public interface IAppPaths
{
    string LegacyDatabasePath { get; }

    string NativeDataRoot { get; }

    string ArtworkCacheRoot { get; }
}

public interface IArtworkCache
{
    Task<Uri?> GetOrCreateAsync(LocalTrack track, CancellationToken cancellationToken = default);
}
