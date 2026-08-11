using System.Numerics;
using LXTA.App.ViewModels;
using LXTA.Domain.Library;
using Microsoft.UI;
using Microsoft.UI.Composition;
using Microsoft.UI.Composition.SystemBackdrops;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Hosting;
using Microsoft.UI.Xaml.Media;
using Windows.Graphics;
using Windows.UI;

namespace LXTA.App;

public sealed partial class MainWindow : Window
{
    private static readonly TimeSpan FadeDuration = TimeSpan.FromMilliseconds(180);
    private static readonly TimeSpan MoveDuration = TimeSpan.FromMilliseconds(220);
    private bool isDark;
    private bool isLoaded;

    public MainWindow(LocalLibraryViewModel viewModel)
    {
        ViewModel = viewModel;
        InitializeComponent();
        Root.DataContext = ViewModel;

        ConfigureWindow();
        ViewModel.ViewStateChanged += ViewModel_ViewStateChanged;
        Root.Loaded += Root_Loaded;
        Closed += MainWindow_Closed;
        RefreshViewState(animate: false);
    }

    public LocalLibraryViewModel ViewModel { get; }

    private void ConfigureWindow()
    {
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(TitleBarDragRegion);
        AppWindow.Title = "LX Music — Native Local Library";
        AppWindow.SetIcon(Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico"));
        AppWindow.Resize(new SizeInt32(1480, 940));
        AppWindow.TitleBar.ButtonBackgroundColor = Colors.Transparent;
        AppWindow.TitleBar.ButtonInactiveBackgroundColor = Colors.Transparent;
        AppWindow.TitleBar.ButtonHoverBackgroundColor = Color.FromArgb(32, 57, 127, 233);
        AppWindow.TitleBar.ButtonPressedBackgroundColor = Color.FromArgb(52, 57, 127, 233);
        SystemBackdrop = new MicaBackdrop { Kind = MicaKind.BaseAlt };
    }

    private async void Root_Loaded(object sender, RoutedEventArgs e)
    {
        if (isLoaded) return;
        isLoaded = true;
        CenterOnPrimaryDisplay();
        await ViewModel.LoadAsync();
    }

    private void CenterOnPrimaryDisplay()
    {
        var display = DisplayArea.GetFromWindowId(AppWindow.Id, DisplayAreaFallback.Primary);
        if (display is null) return;
        var workArea = display.WorkArea;
        var size = AppWindow.Size;
        AppWindow.Move(new PointInt32(
            workArea.X + Math.Max(0, (workArea.Width - size.Width) / 2),
            workArea.Y + Math.Max(0, (workArea.Height - size.Height) / 2)));
    }

    private void MainWindow_Closed(object sender, WindowEventArgs args)
    {
        ViewModel.ViewStateChanged -= ViewModel_ViewStateChanged;
    }

    private void ViewModel_ViewStateChanged(object? sender, EventArgs e) => RefreshViewState(animate: true);

    private void NavigationButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string tag }) return;
        ViewModel.SetView(tag switch
        {
            "albums" => LibraryView.Albums,
            "artists" => LibraryView.Artists,
            _ => LibraryView.Tracks,
        });
    }

    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (isLoaded) ViewModel.SearchText = SearchBox.Text;
    }

    private void AvailabilityBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (isLoaded) ViewModel.SetAvailability(AvailabilityBox.SelectedIndex);
    }

    private void SortBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (isLoaded) ViewModel.SetSort(SortBox.SelectedIndex);
    }

    private void GroupGrid_ItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is GroupCardViewModel group) ViewModel.OpenGroup(group);
    }

    private async void GroupArtwork_Loaded(object sender, RoutedEventArgs e)
    {
        if (sender is Image { DataContext: GroupCardViewModel group })
        {
            await ViewModel.EnsureArtworkAsync(group);
        }
    }

    private void BackToGroups_Click(object sender, RoutedEventArgs e) => ViewModel.CloseGroup();

    private void ThemeButton_Click(object sender, RoutedEventArgs e)
    {
        isDark = !isDark;
        Root.RequestedTheme = isDark ? ElementTheme.Dark : ElementTheme.Light;
        ThemeGlyph.Glyph = isDark ? "\uE708" : "\uE706";
        AppWindow.TitleBar.ButtonForegroundColor = isDark ? Colors.White : Color.FromArgb(255, 24, 34, 53);
        AnimateSurface(LibrarySurface);
    }

    private void RefreshViewState(bool animate)
    {
        var hasError = ViewModel.HasError;
        var isBusy = ViewModel.IsLoading;
        var isDetail = ViewModel.SelectedGroup is not null;
        var isTracks = ViewModel.CurrentView == LibraryView.Tracks;
        var isEmpty = !isBusy && !hasError && ViewModel.VisibleTracks.Count == 0;

        LoadingPanel.Visibility = isBusy ? Visibility.Visible : Visibility.Collapsed;
        ErrorPanel.Visibility = hasError ? Visibility.Visible : Visibility.Collapsed;
        EmptyPanel.Visibility = isEmpty ? Visibility.Visible : Visibility.Collapsed;
        TrackView.Visibility = !isBusy && !hasError && !isEmpty && isTracks && !isDetail ? Visibility.Visible : Visibility.Collapsed;
        GroupGrid.Visibility = !isBusy && !hasError && !isEmpty && !isTracks && !isDetail ? Visibility.Visible : Visibility.Collapsed;
        GroupDetail.Visibility = !isBusy && !hasError && isDetail ? Visibility.Visible : Visibility.Collapsed;

        AppWindow.Title = hasError
            ? "LX Music — 本地曲库不可用"
            : isBusy
                ? "LX Music — 正在读取本地曲库"
                : $"LX Music — 本地音乐 · {ViewModel.VisibleTracks.Count:N0} 首";

        SearchBox.PlaceholderText = ViewModel.CurrentView switch
        {
            LibraryView.Albums => "搜索本地专辑、歌曲或艺术家",
            LibraryView.Artists => "搜索本地艺术家、专辑或歌曲",
            _ => "搜索本地歌曲、歌手、专辑",
        };

        ApplySelectedStyle(TracksNavButton, isTracks);
        ApplySelectedStyle(AlbumsNavButton, ViewModel.CurrentView == LibraryView.Albums);
        ApplySelectedStyle(ArtistsNavButton, ViewModel.CurrentView == LibraryView.Artists);
        ApplySelectedStyle(TracksViewButton, isTracks);
        ApplySelectedStyle(AlbumsViewButton, ViewModel.CurrentView == LibraryView.Albums);
        ApplySelectedStyle(ArtistsViewButton, ViewModel.CurrentView == LibraryView.Artists);

        if (!animate) return;
        FrameworkElement visibleContent = isDetail ? GroupDetail : isTracks ? TrackView : GroupGrid;
        if (visibleContent.Visibility == Visibility.Visible) AnimateSurface(visibleContent);
    }

    private static void ApplySelectedStyle(Button button, bool selected)
    {
        button.Background = selected
            ? (Brush)Microsoft.UI.Xaml.Application.Current.Resources["PrimaryBrush"]
            : new SolidColorBrush(Colors.Transparent);
        button.Foreground = selected
            ? new SolidColorBrush(Colors.White)
            : (Brush)Microsoft.UI.Xaml.Application.Current.Resources["TextBrush"];
    }

    private static void AnimateSurface(UIElement element)
    {
        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        visual.Opacity = 0.15f;
        visual.Offset = new Vector3(0, 10, 0);

        var opacity = compositor.CreateScalarKeyFrameAnimation();
        opacity.Duration = FadeDuration;
        opacity.InsertKeyFrame(1f, 1f, compositor.CreateCubicBezierEasingFunction(
            new Vector2(0.23f, 1f), new Vector2(0.32f, 1f)));

        var offset = compositor.CreateVector3KeyFrameAnimation();
        offset.Duration = MoveDuration;
        offset.InsertKeyFrame(1f, Vector3.Zero, compositor.CreateCubicBezierEasingFunction(
            new Vector2(0.23f, 1f), new Vector2(0.32f, 1f)));

        visual.StartAnimation(nameof(visual.Opacity), opacity);
        visual.StartAnimation(nameof(visual.Offset), offset);
    }
}
