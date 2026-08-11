using LXTA.Application.Abstractions;
using LXTA.Application.Library;
using LXTA.App.ViewModels;
using LXTA.Platform.Windows.Artwork;
using LXTA.Platform.Windows.Paths;
using LXTA.Storage.Legacy;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;

namespace LXTA.App;

public partial class App : Microsoft.UI.Xaml.Application
{
    private readonly ServiceProvider services;
    private MainWindow? window;

    public App()
    {
        InitializeComponent();

        var serviceCollection = new ServiceCollection();
        serviceCollection.AddSingleton<IAppPaths, WindowsAppPaths>();
        serviceCollection.AddSingleton<ILocalLibraryReader, SqliteLegacyLibraryReader>();
        serviceCollection.AddSingleton<IArtworkCache, WindowsArtworkCache>();
        serviceCollection.AddSingleton<LocalLibraryService>();
        serviceCollection.AddTransient<LocalLibraryViewModel>();
        serviceCollection.AddTransient<MainWindow>();
        services = serviceCollection.BuildServiceProvider(validateScopes: true);

        UnhandledException += OnUnhandledException;
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        window = services.GetRequiredService<MainWindow>();
        window.Activate();
    }

    private static void OnUnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs args)
    {
        try
        {
            var path = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "LX-TA",
                "NativeDev",
                "Logs",
                "unhandled.log");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, $"{DateTimeOffset.Now:O}{Environment.NewLine}{args.Exception}{Environment.NewLine}");
        }
        catch
        {
            // A diagnostic failure must not hide the original exception.
        }
    }
}
