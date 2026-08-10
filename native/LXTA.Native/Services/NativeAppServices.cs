namespace LXTA_Native.Services;

public static class NativeAppServices
{
    public static SettingsService Settings { get; } = new();
    public static LibraryService Library { get; } = new(Settings);
    public static PlayerService Player { get; } = new(Settings);
    public static DownloadService Downloads { get; } = new();
    public static ThemeService Themes { get; } = new();
    public static LocalizationService Localization { get; } = new();
    public static DesktopLyricService DesktopLyrics { get; } = new();
    public static LibraryWriteService LibraryWriter { get; } = new(Settings);
    public static LyricService Lyrics { get; } = new(Settings);
    public static UserApiService UserApis { get; } = new(Settings);
    public static SyncService Sync { get; } = new(Settings, Library, LibraryWriter);
    public static HotKeyService HotKeys { get; } = new(Player);
    public static OnlineSearchService Online { get; } = new();
    public static UpdateService Updates { get; } = new();
}
