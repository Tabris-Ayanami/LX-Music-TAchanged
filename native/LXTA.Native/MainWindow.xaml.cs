using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Composition.SystemBackdrops;
using Windows.UI;
using H.NotifyIcon;
using LXTA_Native.Services;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace LXTA_Native;

/// <summary>
/// The application window. This hosts a Frame that displays pages. Add your
/// UI and logic to MainPage.xaml / MainPage.xaml.cs instead of here so you
/// can use Page features such as navigation events and the Loaded lifecycle.
/// </summary>
public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        AppWindow.TitleBar.ButtonBackgroundColor = Color.FromArgb(0, 0, 0, 0);
        AppWindow.TitleBar.ButtonInactiveBackgroundColor = Color.FromArgb(0, 0, 0, 0);
        AppWindow.TitleBar.ButtonHoverBackgroundColor = Color.FromArgb(28, 67, 101, 146);
        AppWindow.TitleBar.ButtonPressedBackgroundColor = Color.FromArgb(40, 67, 101, 146);

        AppWindow.SetIcon("Assets/AppIcon.ico");
        AppWindow.Title = "LX Music";
        Closed += (_, _) =>
        {
            try { NativeAppServices.HotKeys.Dispose(); NativeAppServices.UserApis.DisposeAsync().AsTask().GetAwaiter().GetResult(); NativeAppServices.Sync.DisposeAsync().AsTask().GetAwaiter().GetResult(); NativeAppServices.Player.Dispose(); } catch { }
        };
        Activated += (_, _) => NativeAppServices.HotKeys.Start(WinRT.Interop.WindowNative.GetWindowHandle(this));

        // Navigate the root frame to the main page on startup.
        RootFrame.Navigate(typeof(MainPage));
    }

    public void ApplyBackdrop(string material)
    {
        SystemBackdrop = material switch
        {
            "acrylic" => new DesktopAcrylicBackdrop(),
            "micaAlt" => new MicaBackdrop { Kind = MicaKind.BaseAlt },
            "none" => null,
            _ => new MicaBackdrop(),
        };
    }

    public void SetTrayEnabled(bool enabled)
    {
        TrayIcon.Visibility = enabled ? Visibility.Visible : Visibility.Collapsed;
        if (enabled) TrayIcon.ForceCreate();
    }

    private void ShowWindow_Click(object sender, RoutedEventArgs e) => Activate();

    private void Exit_Click(object sender, RoutedEventArgs e)
    {
        TrayIcon.Dispose();
        Close();
    }
}
