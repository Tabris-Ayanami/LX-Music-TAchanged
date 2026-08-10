using LXTA_Native.Models;
using LXTA_Native.Services;
using LXTA_Native.ViewModels;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;
using Windows.Devices.Enumeration;
using Windows.Media.Devices;

namespace LXTA_Native;

public sealed partial class MainPage : Page
{
    public MainPageViewModel ViewModel { get; } = new();
    private NativeSettings settings = new();
    private readonly DispatcherTimer playbackTimer = new() { Interval = TimeSpan.FromMilliseconds(250) };
    private readonly DispatcherTimer effectSaveTimer = new() { Interval = TimeSpan.FromMilliseconds(350) };
    private bool updatingProgress;
    private bool initializingSettings = true;

    public MainPage()
    {
        InitializeComponent();
        playbackTimer.Tick += PlaybackTimer_Tick;
        effectSaveTimer.Tick += EffectSaveTimer_Tick;
        NativeAppServices.Player.SpectrumChanged += Player_SpectrumChanged;
    }

    private async void Page_Loaded(object sender, RoutedEventArgs e)
    {
        settings = await NativeAppServices.Settings.LoadAsync();
        await ViewModel.LoadUserApisAsync();
        if (!string.IsNullOrWhiteSpace(settings.ApiSourceId) && ViewModel.UserApis.Any(api => api.Id == settings.ApiSourceId))
        {
            try { await NativeAppServices.UserApis.SelectAsync(settings.ApiSourceId); }
            catch (Exception ex) { ViewModel.StatusText = $"音源脚本启动失败：{ex.Message}"; }
        }
        ApiCombo.SelectedIndex = Math.Max(0, ViewModel.UserApis.ToList().FindIndex(api => api.Id == settings.ApiSourceId));
        try
        {
            if (string.Equals(settings.AudioDeviceId, "default", StringComparison.OrdinalIgnoreCase)) settings.AudioDeviceId = string.Empty;
            var devices = await DeviceInformation.FindAllAsync(MediaDevice.GetAudioRenderSelector());
            AudioDeviceCombo.ItemsSource = devices;
            var selectedDevice = devices.ToList().FindIndex(device => device.Id == settings.AudioDeviceId);
            AudioDeviceCombo.SelectedIndex = selectedDevice >= 0 ? selectedDevice : 0;
            if (AudioDeviceCombo.SelectedItem is DeviceInformation selected) await NativeAppServices.Player.SetAudioDeviceAsync(selected.Id == settings.AudioDeviceId ? selected.Id : string.Empty);
        }
        catch { }
        ViewModel.DesktopLyricEnabled = settings.DesktopLyricEnabled;
        VolumeSlider.Value = settings.Volume;
        NativeAppServices.Player.Volume = settings.Volume;
        DesktopLyricToggle.IsOn = settings.DesktopLyricEnabled;
        TrayToggle.IsOn = settings.TrayEnabled;
        SyncToggle.IsOn = settings.SyncEnabled;
        SyncPortBox.Text = settings.SyncPort;
        AutoUpdateToggle.IsOn = settings.AutoUpdateEnabled;
        SpeedSlider.Value = settings.PlaybackRate;
        NativeAppServices.Player.PlaybackRate = settings.PlaybackRate;
        if (settings.EqualizerGains is null || settings.EqualizerGains.Length != 10)
        {
            var normalized = new double[10];
            if (settings.EqualizerGains is not null) Array.Copy(settings.EqualizerGains, normalized, Math.Min(10, settings.EqualizerGains.Length));
            settings.EqualizerGains = normalized;
        }
        var equalizerSliders = new[] { Eq31, Eq62, Eq125, Eq250, Eq500, Eq1000, Eq2000, Eq4000, Eq8000, Eq16000 };
        for (var i = 0; i < equalizerSliders.Length; i++) equalizerSliders[i].Value = settings.EqualizerGains[i];
        EqualizerToggle.IsOn = settings.EqualizerEnabled;
        ReverbSlider.Value = settings.ReverbMix;
        EchoMixSlider.Value = settings.EchoMix;
        EchoDelaySlider.Value = settings.EchoDelay;
        EchoFeedbackSlider.Value = settings.EchoFeedback;
        VisualizationToggle.IsOn = settings.AudioVisualizationEnabled;
        NativeAppServices.Player.VisualizationEnabled = settings.AudioVisualizationEnabled;
        SpectrumView.Visibility = settings.AudioVisualizationEnabled ? Visibility.Visible : Visibility.Collapsed;
        NativeAppServices.Player.ConfigureEffects(settings.EqualizerEnabled, settings.EqualizerGains, settings.ReverbMix, settings.EchoMix, settings.EchoDelay, settings.EchoFeedback);
        App.MainWindow.SetTrayEnabled(settings.TrayEnabled);
        ThemeCombo.ItemsSource = NativeAppServices.Themes.Themes.Select(theme => $"{theme.Name} ({theme.Id})").ToArray();
        ThemeCombo.SelectedIndex = Math.Max(0, NativeAppServices.Themes.Themes.ToList().FindIndex(theme => theme.Id == settings.ThemeId));
        NativeAppServices.Themes.Apply(settings.ThemeId);
        NativeAppServices.Localization.SetLocale(settings.Language);
        LanguageCombo.SelectedIndex = Math.Max(0, NativeAppServices.Localization.Languages.ToList().FindIndex(item => item.Id == settings.Language));
        ApplyLocalization();
        BackdropCombo.SelectedIndex = settings.BackdropMaterial switch { "none" => 0, "micaAlt" => 2, "acrylic" => 3, _ => 1 };
        App.MainWindow.ApplyBackdrop(settings.BackdropMaterial);
        if (settings.AutoUpdateEnabled)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var update = await NativeAppServices.Updates.CheckAsync();
                    if (update?.IsNewer == true) App.DispatcherQueue.TryEnqueue(() => ViewModel.StatusText = $"发现新版本 {update.Version}，可在发布页更新");
                }
                catch { }
            });
        }
        if (settings.SyncEnabled && string.Equals(settings.SyncMode, "server", StringComparison.OrdinalIgnoreCase))
        {
            var syncStatus = await NativeAppServices.Sync.StartServerAsync(int.TryParse(settings.SyncPort, out var syncPort) ? syncPort : 23332);
            ViewModel.StatusText = syncStatus.Message;
        }
        initializingSettings = false;
        ShowSection("home");
        playbackTimer.Start();
    }

    private void Page_Unloaded(object sender, RoutedEventArgs e)
    {
        playbackTimer.Stop();
        effectSaveTimer.Stop();
    }

    private void Player_SpectrumChanged(object? sender, float[] spectrum) => App.DispatcherQueue.TryEnqueue(() => SpectrumView.SetSpectrum(spectrum));

    private void PlaybackTimer_Tick(object? sender, object e)
    {
        ViewModel.UpdatePlaybackPosition();
        updatingProgress = true;
        ProgressSlider.Value = ViewModel.PositionFraction;
        updatingProgress = false;
    }

    private void ShowSection(string tag)
    {
        ViewModel.SelectedSection = tag;
        HomePanel.Visibility = tag == "home" ? Visibility.Visible : Visibility.Collapsed;
        PlaylistPanel.Visibility = tag == "playlists" ? Visibility.Visible : Visibility.Collapsed;
        LocalPanel.Visibility = tag == "local" ? Visibility.Visible : Visibility.Collapsed;
        DownloadsPanel.Visibility = tag == "downloads" ? Visibility.Visible : Visibility.Collapsed;
        SettingsPanel.Visibility = tag == "settings" ? Visibility.Visible : Visibility.Collapsed;

        var activeBrush = Resources["ActiveBlueBrush"] as Brush;
        var inactiveBrush = new SolidColorBrush(Microsoft.UI.Colors.Transparent);
        var activeForeground = new SolidColorBrush(Microsoft.UI.Colors.White);
        var inactiveForeground = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 38, 54, 74));
        foreach (var button in new[] { HomeNavButton, PlaylistNavButton, LocalNavButton, DownloadsNavButton, SettingsNavButton })
        {
            button.Background = inactiveBrush;
            button.Foreground = inactiveForeground;
        }
        var selected = tag switch
        {
            "playlists" => PlaylistNavButton,
            "local" => LocalNavButton,
            "downloads" => DownloadsNavButton,
            "settings" => SettingsNavButton,
            _ => HomeNavButton,
        };
        selected.Background = activeBrush;
        selected.Foreground = activeForeground;
    }

    private void HomeNav_Click(object sender, RoutedEventArgs e) => ShowSection("home");

    private void PlaylistsNav_Click(object sender, RoutedEventArgs e) => ShowSection("playlists");

    private void DownloadsNav_Click(object sender, RoutedEventArgs e) => ShowSection("downloads");

    private void SettingsNav_Click(object sender, RoutedEventArgs e) => ShowSection("settings");

    private void LocalNav_Click(object sender, RoutedEventArgs e)
    {
        var local = ViewModel.Playlists.FirstOrDefault(item => item.Id == "userlist_local_music");
        if (local is not null) ViewModel.LoadPlaylistCommand.Execute(local);
        ShowSection("local");
    }

    private void SearchBox_TextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args) => ViewModel.SearchText = sender.Text;

    private void Track_ItemClick(object sender, ItemClickEventArgs e) => ViewModel.PlayTrackCommand.Execute(e.ClickedItem as Track);

    private void Playlist_ItemClick(object sender, ItemClickEventArgs e)
    {
        ViewModel.LoadPlaylistCommand.Execute(e.ClickedItem as PlaylistSummary);
        ShowSection("playlists");
    }

    private async void CreatePlaylist_Click(object sender, RoutedEventArgs e)
    {
        var input = new TextBox { PlaceholderText = "歌单名称", MaxLength = 80 };
        var dialog = new ContentDialog { XamlRoot = XamlRoot, Title = "新建歌单", Content = input, PrimaryButtonText = "创建", CloseButtonText = "取消", DefaultButton = ContentDialogButton.Primary };
        if (await dialog.ShowAsync() != ContentDialogResult.Primary || string.IsNullOrWhiteSpace(input.Text)) return;
        var created = await NativeAppServices.LibraryWriter.CreatePlaylistAsync(input.Text);
        ViewModel.LoadCommand.Execute(null);
        if (created is not null) ViewModel.LoadPlaylistCommand.Execute(created);
    }

    private async void RenamePlaylist_Click(object sender, RoutedEventArgs e)
    {
        var playlist = ViewModel.SelectedPlaylist;
        if (playlist is null) return;
        var input = new TextBox { Text = playlist.Name, MaxLength = 80, SelectionStart = playlist.Name.Length };
        var dialog = new ContentDialog { XamlRoot = XamlRoot, Title = "重命名歌单", Content = input, PrimaryButtonText = "保存", CloseButtonText = "取消", DefaultButton = ContentDialogButton.Primary };
        if (await dialog.ShowAsync() != ContentDialogResult.Primary || string.IsNullOrWhiteSpace(input.Text)) return;
        await NativeAppServices.LibraryWriter.RenamePlaylistAsync(playlist.Id, input.Text);
        await ReloadPlaylistsAndSelectionAsync(playlist.Id);
    }

    private async void DeletePlaylist_Click(object sender, RoutedEventArgs e)
    {
        var playlist = ViewModel.SelectedPlaylist;
        if (playlist is null || playlist.Id == "userlist_local_music") return;
        var dialog = new ContentDialog { XamlRoot = XamlRoot, Title = "删除歌单", Content = $"确定删除“{playlist.Name}”吗？歌单中的本地文件不会被删除。", PrimaryButtonText = "删除", CloseButtonText = "取消", DefaultButton = ContentDialogButton.Close };
        if (await dialog.ShowAsync() != ContentDialogResult.Primary) return;
        await NativeAppServices.LibraryWriter.DeletePlaylistAsync(playlist.Id);
        ViewModel.SelectedPlaylist = null;
        ViewModel.LoadCommand.Execute(null);
    }

    private async void RemoveSelectedTracks_Click(object sender, RoutedEventArgs e)
    {
        var playlist = ViewModel.SelectedPlaylist;
        var selected = PlaylistTracksList.SelectedItems.OfType<Track>().ToArray();
        if (playlist is null || selected.Length == 0 || playlist.Id == "userlist_local_music") return;
        await NativeAppServices.LibraryWriter.RemoveTracksAsync(playlist.Id, selected.Select(track => track.Id));
        ViewModel.LoadPlaylistCommand.Execute(playlist);
    }

    private async Task ReloadPlaylistsAndSelectionAsync(string playlistId)
    {
        ViewModel.LoadCommand.Execute(null);
        await Task.Delay(100);
        var refreshed = ViewModel.Playlists.FirstOrDefault(item => item.Id == playlistId);
        if (refreshed is not null) ViewModel.LoadPlaylistCommand.Execute(refreshed);
    }

    private void Refresh_Click(object sender, RoutedEventArgs e) => ViewModel.LoadCommand.Execute(null);

    private void RefreshDownloads_Click(object sender, RoutedEventArgs e) => ViewModel.LoadDownloadsCommand.Execute(null);

    private async void ImportFolder_Click(object sender, RoutedEventArgs e)
    {
        var picker = new Windows.Storage.Pickers.FolderPicker();
        picker.FileTypeFilter.Add("*");
        WinRT.Interop.InitializeWithWindow.Initialize(picker, App.WindowHandle);
        var folder = await picker.PickSingleFolderAsync();
        if (folder is null) return;
        try
        {
            var count = await NativeAppServices.LibraryWriter.ImportFolderAsync(folder.Path);
            var local = ViewModel.Playlists.FirstOrDefault(item => item.Id == "userlist_local_music");
            if (local is not null) ViewModel.LoadPlaylistCommand.Execute(local);
            ViewModel.StatusText = $"已导入 {count} 个音频文件";
        }
        catch (Exception ex) { ViewModel.StatusText = $"导入失败：{ex.Message}"; }
    }

    private void Settings_Click(object sender, RoutedEventArgs e)
    {
        ShowSection("settings");
    }

    private async void BackdropCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings || BackdropCombo.SelectedItem is not ComboBoxItem item) return;
        settings.BackdropMaterial = item.Tag?.ToString() ?? "mica";
        App.MainWindow.ApplyBackdrop(settings.BackdropMaterial);
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void ThemeCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings || ThemeCombo.SelectedIndex < 0 || ThemeCombo.SelectedIndex >= NativeAppServices.Themes.Themes.Count) return;
        settings.ThemeId = NativeAppServices.Themes.Themes[ThemeCombo.SelectedIndex].Id;
        NativeAppServices.Themes.Apply(settings.ThemeId);
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void LanguageCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings || LanguageCombo.SelectedItem is not ComboBoxItem item) return;
        settings.Language = item.Tag?.ToString() ?? "zh-cn";
        NativeAppServices.Localization.SetLocale(settings.Language);
        ApplyLocalization();
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private void ApplyLocalization()
    {
        LocalizeVisualTree(PageRoot);
        SearchBox.PlaceholderText = "Search for something...";
    }

    private static void LocalizeVisualTree(DependencyObject root)
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            switch (child)
            {
                case TextBlock textBlock:
                    textBlock.Text = NativeAppServices.Localization.Translate(textBlock.Text);
                    break;
                case Button button when button.Content is string content:
                    button.Content = NativeAppServices.Localization.Translate(content);
                    break;
                case ToggleSwitch toggle when toggle.Header is string header:
                    toggle.Header = NativeAppServices.Localization.Translate(header);
                    break;
                case ComboBoxItem comboItem when comboItem.Content is string itemContent:
                    comboItem.Content = NativeAppServices.Localization.Translate(itemContent);
                    break;
                case AutoSuggestBox autoSuggest:
                    autoSuggest.PlaceholderText = NativeAppServices.Localization.Translate(autoSuggest.PlaceholderText);
                    break;
            }
            LocalizeVisualTree(child);
        }
    }

    private async void DesktopLyricToggle_Toggled(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.DesktopLyricEnabled = DesktopLyricToggle.IsOn;
        ViewModel.DesktopLyricEnabled = settings.DesktopLyricEnabled;
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void TrayToggle_Toggled(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.TrayEnabled = TrayToggle.IsOn;
        App.MainWindow.SetTrayEnabled(settings.TrayEnabled);
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void ApiCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings || ApiCombo.SelectedItem is not UserApiInfo api) return;
        try
        {
            await NativeAppServices.UserApis.SelectAsync(api.Id);
            settings.ApiSourceId = api.Id;
            await NativeAppServices.Settings.SaveAsync(settings);
            ViewModel.StatusText = $"在线音源已连接：{api.Name}";
        }
        catch (Exception ex) { ViewModel.StatusText = $"音源脚本启动失败：{ex.Message}"; }
    }

    private async void AudioDeviceCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings || AudioDeviceCombo.SelectedItem is not DeviceInformation device) return;
        settings.AudioDeviceId = device.Id;
        await NativeAppServices.Player.SetAudioDeviceAsync(device.Id);
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void SyncToggle_Toggled(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.SyncEnabled = SyncToggle.IsOn;
        if (SyncToggle.IsOn)
        {
            settings.SyncPort = SyncPortBox.Text.Trim();
            var status = await NativeAppServices.Sync.StartServerAsync(int.TryParse(settings.SyncPort, out var port) ? port : 23332);
            ViewModel.StatusText = status.Message;
        }
        else await NativeAppServices.Sync.StopServerAsync();
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void AutoUpdateToggle_Toggled(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.AutoUpdateEnabled = AutoUpdateToggle.IsOn;
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void SpeedSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.PlaybackRate = e.NewValue;
        NativeAppServices.Player.PlaybackRate = e.NewValue;
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private async void VolumeSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        ViewModel.SetVolume(e.NewValue);
        settings.Volume = e.NewValue;
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private void EqualizerToggle_Toggled(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.EqualizerEnabled = EqualizerToggle.IsOn;
        NativeAppServices.Player.SetEqualizerEnabled(settings.EqualizerEnabled);
        ScheduleEffectSettingsSave();
    }

    private void EqualizerSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings || sender is not Slider slider || !int.TryParse(slider.Tag?.ToString(), out var index) || (uint)index >= 10) return;
        settings.EqualizerGains[index] = e.NewValue;
        NativeAppServices.Player.SetEqualizerGain(index, e.NewValue);
        ScheduleEffectSettingsSave();
    }

    private void ReverbSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.ReverbMix = e.NewValue;
        NativeAppServices.Player.SetReverbMix(e.NewValue);
        ScheduleEffectSettingsSave();
    }

    private void EchoSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.EchoMix = EchoMixSlider.Value;
        settings.EchoDelay = EchoDelaySlider.Value;
        settings.EchoFeedback = EchoFeedbackSlider.Value;
        NativeAppServices.Player.SetEcho(settings.EchoMix, settings.EchoDelay, settings.EchoFeedback);
        ScheduleEffectSettingsSave();
    }

    private void VisualizationToggle_Toggled(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || initializingSettings) return;
        settings.AudioVisualizationEnabled = VisualizationToggle.IsOn;
        NativeAppServices.Player.VisualizationEnabled = settings.AudioVisualizationEnabled;
        SpectrumView.Visibility = settings.AudioVisualizationEnabled ? Visibility.Visible : Visibility.Collapsed;
        if (!settings.AudioVisualizationEnabled) SpectrumView.Clear();
        ScheduleEffectSettingsSave();
    }

    private void ScheduleEffectSettingsSave()
    {
        effectSaveTimer.Stop();
        effectSaveTimer.Start();
    }

    private async void EffectSaveTimer_Tick(object? sender, object e)
    {
        effectSaveTimer.Stop();
        await NativeAppServices.Settings.SaveAsync(settings);
    }

    private void ProgressSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (!IsLoaded || updatingProgress) return;
        ViewModel.Seek(e.NewValue);
    }
}
