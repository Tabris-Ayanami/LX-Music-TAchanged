namespace LXTA_Native.Models;

public sealed class NativeSettings
{
    public bool LegacySettingsImported { get; set; }
    public string ThemeId { get; set; } = "green";
    public string BackdropMaterial { get; set; } = "mica";
    public string Language { get; set; } = "zh-cn";
    public int WindowWidth { get; set; } = 1114;
    public int WindowHeight { get; set; } = 718;
    public double Volume { get; set; } = 1;
    public bool IsMuted { get; set; }
    public bool DesktopLyricEnabled { get; set; }
    public bool TrayEnabled { get; set; }
    public bool AutoUpdateEnabled { get; set; } = true;
    public string DownloadPath { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "LX-TA");
    public string DataRoot { get; set; } = string.Empty;
    public bool SyncEnabled { get; set; }
    public string SyncMode { get; set; } = "server";
    public string SyncPort { get; set; } = "23332";
    public string SyncClientHost { get; set; } = string.Empty;
    public bool HotKeysEnabled { get; set; } = true;
    public string ApiSourceId { get; set; } = string.Empty;
    public double PlaybackRate { get; set; } = 1;
    public bool EqualizerEnabled { get; set; }
    public double[] EqualizerGains { get; set; } = new double[10];
    public double ReverbMix { get; set; }
    public double EchoMix { get; set; }
    public double EchoDelay { get; set; } = 180;
    public double EchoFeedback { get; set; } = 20;
    public bool AudioVisualizationEnabled { get; set; } = true;
    public string AudioDeviceId { get; set; } = string.Empty;
}
