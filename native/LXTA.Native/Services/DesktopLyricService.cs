using System.Runtime.InteropServices;
using LXTA_Native.Models;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.Graphics;

namespace LXTA_Native.Services;

public sealed class DesktopLyricService : IDisposable
{
    private Window? window;
    private TextBlock? line;
    private Track? currentTrack;

    public bool IsEnabled { get; private set; }

    public void SetEnabled(bool enabled)
    {
        IsEnabled = enabled;
        if (enabled)
        {
            EnsureWindow();
            window?.Activate();
        }
        else window?.Close();
    }

    public void UpdateTrack(Track track)
    {
        currentTrack = track;
        if (!IsEnabled) return;
        EnsureWindow();
        line!.Text = track.Name;
    }

    public void UpdateLine(string text)
    {
        if (!IsEnabled || string.IsNullOrWhiteSpace(text)) return;
        EnsureWindow();
        line!.Text = text;
    }

    private void EnsureWindow()
    {
        if (window is not null) return;
        window = new Window { Title = "LX Music Desktop Lyric" };
        var root = new Grid { Background = new SolidColorBrush(Colors.Transparent), Padding = new Thickness(24, 12, 24, 12) };
        line = new TextBlock
        {
            Text = currentTrack?.Name ?? "LX Music",
            FontSize = 28,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Colors.White),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            TextTrimming = TextTrimming.CharacterEllipsis,
            Shadow = new ThemeShadow(),
        };
        root.Children.Add(line);
        window.Content = root;
        window.Closed += (_, _) => { window = null; line = null; };
        var presenter = window.AppWindow.Presenter as OverlappedPresenter;
        if (presenter is not null)
        {
            presenter.IsAlwaysOnTop = true;
            presenter.IsResizable = true;
            presenter.SetBorderAndTitleBar(false, false);
        }
        window.AppWindow.Resize(new SizeInt32(680, 100));
        MakeClickThrough(window);
    }

    private static void MakeClickThrough(Window target)
    {
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(target);
        var style = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64();
        SetWindowLongPtr(hwnd, GwlExStyle, new nint(style | WsExTransparent | WsExLayered | WsExToolWindow));
    }

    public void Dispose() => window?.Close();

    private const int GwlExStyle = -20;
    private const long WsExTransparent = 0x20;
    private const long WsExLayered = 0x80000;
    private const long WsExToolWindow = 0x80;

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern nint GetWindowLongPtr(nint hwnd, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern nint SetWindowLongPtr(nint hwnd, int index, nint value);
}
