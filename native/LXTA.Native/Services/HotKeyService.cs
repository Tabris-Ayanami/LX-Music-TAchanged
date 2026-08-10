using System.Runtime.InteropServices;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class HotKeyService : IDisposable
{
    private const int WmHotKey = 0x0312;
    private const uint ModAlt = 0x0001, ModControl = 0x0002;
    private const int PlayPauseId = 7101, PreviousId = 7102, NextId = 7103;
    private readonly PlayerService player;
    private readonly Win32.WndProc callback;
    private nint hwnd;
    private nint previousProc;
    private bool started;

    public HotKeyService(PlayerService player) { this.player = player; callback = WndProc; }
    public event EventHandler<string>? StatusChanged;

    public void Start(nint windowHandle)
    {
        if (started || windowHandle == 0) return;
        hwnd = windowHandle;
        if (!Win32.RegisterHotKey(hwnd, PlayPauseId, ModControl | ModAlt, 0x20) || !Win32.RegisterHotKey(hwnd, PreviousId, ModControl | ModAlt, 0x25) || !Win32.RegisterHotKey(hwnd, NextId, ModControl | ModAlt, 0x27))
        {
            Unregister(); StatusChanged?.Invoke(this, "全局热键注册失败，可能已被其他应用占用"); return;
        }
        previousProc = Win32.SetWindowLongPtr(hwnd, -4, Marshal.GetFunctionPointerForDelegate(callback)); started = true; StatusChanged?.Invoke(this, "全局热键已启用");
    }

    private nint WndProc(nint window, uint message, nint wParam, nint lParam)
    {
        if (message == WmHotKey)
        {
            switch (wParam.ToInt32()) { case PlayPauseId: player.Toggle(); break; case PreviousId: _ = player.PreviousAsync(); break; case NextId: _ = player.NextAsync(); break; }
            return 0;
        }
        return Win32.CallWindowProc(previousProc, window, message, wParam, lParam);
    }

    private void Unregister() { if (hwnd == 0) return; Win32.UnregisterHotKey(hwnd, PlayPauseId); Win32.UnregisterHotKey(hwnd, PreviousId); Win32.UnregisterHotKey(hwnd, NextId); }
    public void Dispose() { if (!started) return; if (previousProc != 0) Win32.SetWindowLongPtr(hwnd, -4, previousProc); Unregister(); started = false; }

    private static class Win32
    {
        [UnmanagedFunctionPointer(CallingConvention.Winapi)] public delegate nint WndProc(nint hwnd, uint msg, nint wParam, nint lParam);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool RegisterHotKey(nint hwnd, int id, uint modifiers, uint key);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool UnregisterHotKey(nint hwnd, int id);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern nint SetWindowLongPtr(nint hwnd, int index, nint value);
        [DllImport("user32.dll")] public static extern nint CallWindowProc(nint proc, nint hwnd, uint msg, nint wParam, nint lParam);
    }
}
