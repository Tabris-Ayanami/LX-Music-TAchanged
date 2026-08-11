using LXTA.Application.Abstractions;
using LXTA.Domain.Library;

namespace LXTA.Application.Library;

public sealed class LocalLibraryService(ILocalLibraryReader reader)
{
    public Task<LocalLibrarySnapshot> LoadAsync(CancellationToken cancellationToken = default) =>
        reader.ReadAsync(cancellationToken);

    public Task<IReadOnlyList<LocalTrack>> QueryAsync(
        IReadOnlyList<LocalTrack> tracks,
        LocalLibraryQuery query,
        CancellationToken cancellationToken = default) =>
        Task.Run(() =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            return LocalLibraryQueries.Apply(tracks, query);
        }, cancellationToken);
}
