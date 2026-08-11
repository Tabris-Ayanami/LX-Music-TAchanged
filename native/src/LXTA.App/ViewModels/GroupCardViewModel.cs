using CommunityToolkit.Mvvm.ComponentModel;
using LXTA.Domain.Library;

namespace LXTA.App.ViewModels;

public sealed class GroupCardViewModel(LocalLibraryGroup group) : ObservableObject
{
    private Uri? artworkUri;
    private bool artworkRequested;

    public LocalLibraryGroup Group { get; } = group;

    public string Title => Group.Title;

    public string Subtitle => $"{Group.Subtitle} · {Group.TrackCount} 首";

    public string Initial => string.IsNullOrWhiteSpace(Title) ? "?" : Title[..1].ToUpperInvariant();

    public Uri? ArtworkUri
    {
        get => artworkUri;
        set => SetProperty(ref artworkUri, value);
    }

    public bool TryBeginArtworkRequest()
    {
        if (artworkRequested) return false;
        artworkRequested = true;
        return true;
    }
}
