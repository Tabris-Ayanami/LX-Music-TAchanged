using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LXTA_Native.Models;
using LXTA_Native.Services;

namespace LXTA_Native.ViewModels;

public partial class MainPageViewModel : ObservableObject
{
    private readonly LibraryService library = NativeAppServices.Library;
    private readonly PlayerService player = NativeAppServices.Player;
    private CancellationTokenSource? searchCancellation;

    public ObservableCollection<PlaylistSummary> Playlists { get; } = new();
    public ObservableCollection<Track> Tracks { get; } = new();
    public ObservableCollection<DownloadItem> Downloads { get; } = new();
    public ObservableCollection<LyricLine> Lyrics { get; } = new();
    public ObservableCollection<UserApiInfo> UserApis { get; } = new();

    [ObservableProperty] public partial string SearchText { get; set; } = string.Empty;
    [ObservableProperty] public partial string StatusText { get; set; } = "正在读取本地音乐库…";
    [ObservableProperty] public partial string SelectedSection { get; set; } = "home";
    [ObservableProperty] public partial PlaylistSummary? SelectedPlaylist { get; set; }
    [ObservableProperty] public partial Track? CurrentTrack { get; set; }
    [ObservableProperty] public partial bool IsPlaying { get; set; }
    [ObservableProperty] public partial bool IsBusy { get; set; }
    [ObservableProperty] public partial bool DesktopLyricEnabled { get; set; }
    [ObservableProperty] public partial double Volume { get; set; } = 1;
    [ObservableProperty] public partial double PositionFraction { get; set; }
    [ObservableProperty] public partial string PositionText { get; set; } = "00:00";
    [ObservableProperty] public partial string DurationText { get; set; } = "00:00";
    [ObservableProperty] public partial string CurrentLyricText { get; set; } = "暂无歌词";
    [ObservableProperty] public partial string PlaybackModeText { get; set; } = "列表循环";

    public MainPageViewModel()
    {
        player.CurrentTrackChanged += (_, track) => App.DispatcherQueue.TryEnqueue(() => _ = OnCurrentTrackChangedAsync(track));
        player.PlaybackStateChanged += (_, _) => App.DispatcherQueue.TryEnqueue(() => IsPlaying = player.IsPlaying);
        player.PlaybackFailed += (_, message) => App.DispatcherQueue.TryEnqueue(() => StatusText = $"播放失败：{message}");
        _ = LoadAsync();
        _ = LoadDownloadsAsync();
    }

    public async Task LoadUserApisAsync()
    {
        UserApis.Clear();
        foreach (var api in await NativeAppServices.UserApis.GetApisAsync()) UserApis.Add(api);
    }

    public void SetVolume(double value)
    {
        Volume = Math.Clamp(value, 0, 1);
        player.Volume = Volume;
    }

    partial void OnSearchTextChanged(string value) => _ = SearchAsync(value);

    [RelayCommand]
    private async Task LoadAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            Playlists.Clear();
            foreach (var list in await library.LoadPlaylistsAsync()) Playlists.Add(list);
            Tracks.Clear();
            foreach (var track in await library.LoadTracksAsync()) Tracks.Add(track);
            StatusText = $"已载入 {Tracks.Count} 首歌曲，{Playlists.Count} 个歌单";
        }
        catch (Exception ex)
        {
            StatusText = $"音乐库读取失败：{ex.Message}";
        }
        finally { IsBusy = false; }
    }

    private async Task SearchAsync(string value)
    {
        searchCancellation?.Cancel(); searchCancellation?.Dispose(); searchCancellation = new CancellationTokenSource();
        var cancellationToken = searchCancellation.Token;
        try
        {
            await Task.Delay(250, cancellationToken);
            var tracks = (await library.LoadTracksAsync(search: string.IsNullOrWhiteSpace(value) ? null : value, cancellationToken: cancellationToken)).ToList();
            if (!string.IsNullOrWhiteSpace(value))
            {
                try { tracks.AddRange(await NativeAppServices.Online.SearchAllAsync(value, cancellationToken: cancellationToken)); } catch { /* 网络源不可用时仍显示本地结果 */ }
            }
            Tracks.Clear(); foreach (var track in tracks.DistinctBy(track => track.Id)) Tracks.Add(track);
            StatusText = string.IsNullOrWhiteSpace(value) ? $"已载入 {Tracks.Count} 首歌曲" : $"找到 {Tracks.Count} 首相关歌曲（含在线结果）";
        }
        catch (OperationCanceledException) { }
    }

    [RelayCommand]
    private async Task LoadPlaylistAsync(PlaylistSummary? playlist)
    {
        if (playlist is null) return;
        SelectedPlaylist = playlist;
        var tracks = await library.LoadTracksAsync(playlist.Id);
        Tracks.Clear();
        foreach (var track in tracks) Tracks.Add(track);
        SelectedSection = "playlists";
        StatusText = $"{playlist.Name} · {Tracks.Count} 首歌曲";
    }

    [RelayCommand]
    private async Task LoadDownloadsAsync()
    {
        Downloads.Clear();
        foreach (var item in await library.LoadDownloadsAsync()) Downloads.Add(item);
    }

    [RelayCommand]
    private async Task ResumeDownloadAsync(DownloadItem? item)
    {
        if (item is null) return;
        StatusText = $"正在下载：{item.FileName}";
        var result = await NativeAppServices.Downloads.ResumeAsync(item, new Progress<double>(value => StatusText = $"正在下载：{item.FileName} · {value:P0}"));
        var index = Downloads.IndexOf(item);
        if (index >= 0) Downloads[index] = result;
        StatusText = result.Status;
    }

    [RelayCommand]
    private async Task PlayTrackAsync(Track? track)
    {
        if (track is null) return;
        if (await player.PlayAsync(track, Tracks.ToArray())) StatusText = $"正在播放：{track.Name}";
        else StatusText = $"无法播放：{track.Name}（本地文件不存在或尚未解析音源）";
    }

    [RelayCommand]
    private void TogglePlay()
    {
        player.Toggle();
        IsPlaying = player.IsPlaying;
    }

    [RelayCommand]
    private async Task NextAsync() => await player.NextAsync();

    [RelayCommand]
    private async Task PreviousAsync() => await player.PreviousAsync();

    [RelayCommand]
    private void CyclePlaybackMode()
    {
        player.Mode = player.Mode switch
        {
            PlaybackMode.ListLoop => PlaybackMode.SingleLoop,
            PlaybackMode.SingleLoop => PlaybackMode.Shuffle,
            _ => PlaybackMode.ListLoop,
        };
        PlaybackModeText = player.Mode switch
        {
            PlaybackMode.SingleLoop => "单曲循环",
            PlaybackMode.Shuffle => "随机播放",
            _ => "列表循环",
        };
    }

    public void Seek(double fraction) => player.Seek(fraction);

    public void UpdatePlaybackPosition()
    {
        var duration = player.Duration;
        var position = player.Position;
        PositionFraction = duration > TimeSpan.Zero ? Math.Clamp(position.TotalMilliseconds / duration.TotalMilliseconds, 0, 1) : 0;
        PositionText = FormatTime(position);
        DurationText = FormatTime(duration);

        var active = Lyrics.LastOrDefault(line => line.Time <= position);
        CurrentLyricText = active?.Text is { Length: > 0 } text
            ? string.IsNullOrWhiteSpace(active.Translation) ? text : $"{text}  {active.Translation}"
            : "暂无歌词";
        if (DesktopLyricEnabled) NativeAppServices.DesktopLyrics.UpdateLine(CurrentLyricText);
    }

    private async Task OnCurrentTrackChangedAsync(Track? track)
    {
        CurrentTrack = track;
        IsPlaying = player.IsPlaying;
        Lyrics.Clear();
        CurrentLyricText = "正在加载歌词…";
        if (track is null) return;
        NativeAppServices.DesktopLyrics.UpdateTrack(track);
        try
        {
            foreach (var line in await NativeAppServices.Lyrics.LoadAsync(track.Id, track.Source)) Lyrics.Add(line);
            CurrentLyricText = Lyrics.Count == 0 ? "暂无歌词" : Lyrics[0].Text;
        }
        catch (Exception ex)
        {
            CurrentLyricText = "歌词读取失败";
            StatusText = $"歌词读取失败：{ex.Message}";
        }
    }

    private static string FormatTime(TimeSpan value) => value.TotalHours >= 1
        ? value.ToString(@"h\:mm\:ss")
        : value.ToString(@"mm\:ss");

    partial void OnDesktopLyricEnabledChanged(bool value) => NativeAppServices.DesktopLyrics.SetEnabled(value);
}
