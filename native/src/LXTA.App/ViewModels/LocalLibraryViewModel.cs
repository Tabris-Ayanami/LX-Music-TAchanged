using CommunityToolkit.Mvvm.ComponentModel;
using LXTA.Application.Abstractions;
using LXTA.Application.Library;
using LXTA.Domain.Library;

namespace LXTA.App.ViewModels;

public sealed class LocalLibraryViewModel(
    LocalLibraryService libraryService,
    IArtworkCache artworkCache,
    IAppPaths paths) : ObservableObject
{
    private IReadOnlyList<LocalTrack> allTracks = Array.Empty<LocalTrack>();
    private IReadOnlyList<LocalTrack> visibleTracks = Array.Empty<LocalTrack>();
    private IReadOnlyList<GroupCardViewModel> visibleGroups = Array.Empty<GroupCardViewModel>();
    private IReadOnlyList<LocalTrack> detailTracks = Array.Empty<LocalTrack>();
    private CancellationTokenSource? queryCancellation;
    private string searchText = string.Empty;
    private string statusMessage = "正在读取本地曲库…";
    private string errorMessage = string.Empty;
    private LibraryView currentView = LibraryView.Tracks;
    private TrackAvailabilityFilter availability = TrackAvailabilityFilter.All;
    private TrackSort sort = TrackSort.Original;
    private bool isLoading = true;
    private GroupCardViewModel? selectedGroup;

    public event EventHandler? ViewStateChanged;

    public IReadOnlyList<LocalTrack> VisibleTracks
    {
        get => visibleTracks;
        private set => SetProperty(ref visibleTracks, value);
    }

    public IReadOnlyList<GroupCardViewModel> VisibleGroups
    {
        get => visibleGroups;
        private set => SetProperty(ref visibleGroups, value);
    }

    public IReadOnlyList<LocalTrack> DetailTracks
    {
        get => detailTracks;
        private set => SetProperty(ref detailTracks, value);
    }

    public string SearchText
    {
        get => searchText;
        set
        {
            if (!SetProperty(ref searchText, value)) return;
            QueueQuery();
        }
    }

    public string StatusMessage
    {
        get => statusMessage;
        private set => SetProperty(ref statusMessage, value);
    }

    public string ErrorMessage
    {
        get => errorMessage;
        private set
        {
            if (SetProperty(ref errorMessage, value)) OnPropertyChanged(nameof(HasError));
        }
    }

    public bool HasError => ErrorMessage.Length > 0;

    public bool IsLoading
    {
        get => isLoading;
        private set => SetProperty(ref isLoading, value);
    }

    public string SourceDatabasePath => paths.LegacyDatabasePath;

    public LibraryView CurrentView => currentView;

    public TrackAvailabilityFilter Availability => availability;

    public TrackSort Sort => sort;

    public GroupCardViewModel? SelectedGroup
    {
        get => selectedGroup;
        private set => SetProperty(ref selectedGroup, value);
    }

    public string ResultSummary
    {
        get
        {
            var availableCount = allTracks.Count(track => track.IsAvailable);
            return $"{VisibleTracks.Count:N0} 首显示 · {allTracks.Count:N0} 首索引 · {availableCount:N0} 个文件可访问";
        }
    }

    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = string.Empty;
        try
        {
            var snapshot = await libraryService.LoadAsync();
            allTracks = snapshot.Tracks;
            StatusMessage = $"只读连接 · {snapshot.LoadedAt:HH:mm:ss}";
            await ApplyQueryAsync(immediate: true);
        }
        catch (Exception exception)
        {
            allTracks = Array.Empty<LocalTrack>();
            VisibleTracks = Array.Empty<LocalTrack>();
            VisibleGroups = Array.Empty<GroupCardViewModel>();
            ErrorMessage = exception.Message;
            StatusMessage = "本地曲库不可用";
            NotifyResultChanged();
        }
        finally
        {
            IsLoading = false;
            ViewStateChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public void SetView(LibraryView view)
    {
        if (currentView == view && SelectedGroup is null) return;
        currentView = view;
        SelectedGroup = null;
        DetailTracks = Array.Empty<LocalTrack>();
        OnPropertyChanged(nameof(CurrentView));
        RebuildGroups();
        ViewStateChanged?.Invoke(this, EventArgs.Empty);
    }

    public void SetAvailability(int index)
    {
        availability = index switch
        {
            1 => TrackAvailabilityFilter.Available,
            2 => TrackAvailabilityFilter.Missing,
            _ => TrackAvailabilityFilter.All,
        };
        OnPropertyChanged(nameof(Availability));
        QueueQuery();
    }

    public void SetSort(int index)
    {
        sort = index switch
        {
            1 => TrackSort.Title,
            2 => TrackSort.Artist,
            3 => TrackSort.Album,
            4 => TrackSort.Duration,
            _ => TrackSort.Original,
        };
        OnPropertyChanged(nameof(Sort));
        QueueQuery();
    }

    public void OpenGroup(GroupCardViewModel group)
    {
        SelectedGroup = group;
        DetailTracks = group.Group.Tracks;
        ViewStateChanged?.Invoke(this, EventArgs.Empty);
    }

    public void CloseGroup()
    {
        SelectedGroup = null;
        DetailTracks = Array.Empty<LocalTrack>();
        ViewStateChanged?.Invoke(this, EventArgs.Empty);
    }

    public async Task EnsureArtworkAsync(GroupCardViewModel group)
    {
        if (group.ArtworkUri is not null || !group.TryBeginArtworkRequest()) return;
        group.ArtworkUri = await artworkCache.GetOrCreateAsync(group.Group.ArtworkSource);
    }

    private void QueueQuery()
    {
        queryCancellation?.Cancel();
        queryCancellation?.Dispose();
        queryCancellation = new CancellationTokenSource();
        _ = ApplyQueryAsync(immediate: false, queryCancellation.Token);
    }

    private async Task ApplyQueryAsync(bool immediate, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!immediate) await Task.Delay(120, cancellationToken);
            var query = new LocalLibraryQuery(SearchText, Availability, Sort);
            VisibleTracks = await libraryService.QueryAsync(allTracks, query, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            RebuildGroups();
            NotifyResultChanged();
            ViewStateChanged?.Invoke(this, EventArgs.Empty);
        }
        catch (OperationCanceledException)
        {
        }
    }

    private void RebuildGroups()
    {
        var groups = currentView switch
        {
            LibraryView.Albums => LocalLibraryQueries.BuildAlbumGroups(VisibleTracks),
            LibraryView.Artists => LocalLibraryQueries.BuildArtistGroups(VisibleTracks),
            _ => Array.Empty<LocalLibraryGroup>(),
        };
        VisibleGroups = groups.Select(group => new GroupCardViewModel(group)).ToArray();
    }

    private void NotifyResultChanged()
    {
        OnPropertyChanged(nameof(ResultSummary));
    }
}
