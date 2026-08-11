using LXTA.Application.Abstractions;

namespace LXTA.Platform.Windows.Paths;

public sealed class WindowsAppPaths : IAppPaths
{
    public WindowsAppPaths()
    {
        LegacyDatabasePath = ResolveLegacyDatabasePath();
        NativeDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "LX-TA",
            "NativeDev");
        ArtworkCacheRoot = Path.Combine(NativeDataRoot, "Cache", "Artwork");

        Directory.CreateDirectory(ArtworkCacheRoot);
    }

    public string LegacyDatabasePath { get; }

    public string NativeDataRoot { get; }

    public string ArtworkCacheRoot { get; }

    private static string ResolveLegacyDatabasePath()
    {
        var environmentOverride = Environment.GetEnvironmentVariable("LXTA_LEGACY_DB_PATH");
        if (!string.IsNullOrWhiteSpace(environmentOverride))
        {
            return Path.GetFullPath(environmentOverride);
        }

        var arguments = Environment.GetCommandLineArgs();
        for (var index = 0; index < arguments.Length - 1; index++)
        {
            if (string.Equals(arguments[index], "--legacy-db", StringComparison.OrdinalIgnoreCase))
            {
                return Path.GetFullPath(arguments[index + 1]);
            }
        }

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "LX-TA",
            "LxDatas",
            "lx.data.db");
    }
}
