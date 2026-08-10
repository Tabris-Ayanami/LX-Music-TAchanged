using System.Text.Json;
using System.Text.Json.Nodes;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class SettingsService
{
    private readonly string nativeRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "LX-TA", "NativeData");
    private readonly string settingsPath;
    private readonly SemaphoreSlim gate = new(1, 1);

    public SettingsService()
    {
        settingsPath = Path.Combine(nativeRoot, "settings.json");
    }

    public async Task<NativeSettings> LoadAsync(CancellationToken cancellationToken = default)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(nativeRoot);
            if (File.Exists(settingsPath))
            {
                await using var stream = new FileStream(settingsPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 4096, FileOptions.Asynchronous | FileOptions.SequentialScan);
                var existing = await JsonSerializer.DeserializeAsync<NativeSettings>(stream, cancellationToken: cancellationToken) ?? new NativeSettings();
                if (!existing.LegacySettingsImported)
                {
                    existing = await ImportElectronSettingsAsync(cancellationToken, existing);
                    await SaveCoreAsync(existing, cancellationToken);
                }
                return existing;
            }

            var settings = await ImportElectronSettingsAsync(cancellationToken, new NativeSettings());
            await SaveCoreAsync(settings, cancellationToken);
            return settings;
        }
        finally { gate.Release(); }
    }

    public async Task SaveAsync(NativeSettings settings, CancellationToken cancellationToken = default)
    {
        await gate.WaitAsync(cancellationToken);
        try { await SaveCoreAsync(settings, cancellationToken); }
        finally { gate.Release(); }
    }

    private async Task SaveCoreAsync(NativeSettings settings, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(nativeRoot);
        await using (var stream = new FileStream(settingsPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite, 4096, FileOptions.Asynchronous | FileOptions.SequentialScan))
            await JsonSerializer.SerializeAsync(stream, settings, new JsonSerializerOptions { WriteIndented = true }, cancellationToken);
    }

    private async Task<NativeSettings> ImportElectronSettingsAsync(CancellationToken cancellationToken, NativeSettings settings)
    {
        var legacyPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "LX-TA", "LxDatas", "config_v2.json");
        if (!File.Exists(legacyPath)) { settings.LegacySettingsImported = true; return settings; }

        try
        {
            await using var stream = File.OpenRead(legacyPath);
            var root = await JsonNode.ParseAsync(stream, cancellationToken: cancellationToken) as JsonObject;
            if (root is null) return settings;
            var legacy = root["setting"] as JsonObject ?? root;
            settings.ThemeId = legacy["theme.id"]?.GetValue<string>() ?? settings.ThemeId;
            settings.BackdropMaterial = legacy["common.transparentWindow"]?.GetValue<bool>() == true ? "acrylic" : settings.BackdropMaterial;
            settings.Language = legacy["common.langId"]?.GetValue<string>() ?? settings.Language;
            settings.Volume = legacy["player.volume"]?.GetValue<double>() ?? settings.Volume;
            settings.IsMuted = legacy["player.isMute"]?.GetValue<bool>() ?? settings.IsMuted;
            settings.DesktopLyricEnabled = legacy["desktopLyric.enable"]?.GetValue<bool>() ?? settings.DesktopLyricEnabled;
            settings.TrayEnabled = legacy["tray.enable"]?.GetValue<bool>() ?? settings.TrayEnabled;
            settings.AutoUpdateEnabled = legacy["common.tryAutoUpdate"]?.GetValue<bool>() ?? settings.AutoUpdateEnabled;
            settings.DownloadPath = legacy["download.savePath"]?.GetValue<string>() ?? settings.DownloadPath;
            settings.SyncEnabled = legacy["sync.enable"]?.GetValue<bool>() ?? settings.SyncEnabled;
            settings.SyncMode = legacy["sync.mode"]?.GetValue<string>() ?? settings.SyncMode;
            settings.SyncPort = legacy["sync.server.port"]?.GetValue<string>() ?? settings.SyncPort;
            settings.SyncClientHost = legacy["sync.client.host"]?.GetValue<string>() ?? settings.SyncClientHost;
            settings.HotKeysEnabled = legacy["hotKey.enable"]?.GetValue<bool>() ?? settings.HotKeysEnabled;
            settings.ApiSourceId = legacy["common.apiSource"]?.GetValue<string>() ?? settings.ApiSourceId;
            settings.PlaybackRate = legacy["player.playbackRate"]?.GetValue<double>() ?? settings.PlaybackRate;
            settings.AudioDeviceId = legacy["player.mediaDeviceId"]?.GetValue<string>() ?? settings.AudioDeviceId;
            var equalizerKeys = new[] { "31", "62", "125", "250", "500", "1000", "2000", "4000", "8000", "16000" };
            for (var i = 0; i < equalizerKeys.Length; i++)
            {
                settings.EqualizerGains[i] = legacy[$"player.soundEffect.biquadFilter.hz{equalizerKeys[i]}"]?.GetValue<double>() ?? settings.EqualizerGains[i];
                if (Math.Abs(settings.EqualizerGains[i]) > 0.001) settings.EqualizerEnabled = true;
            }
            settings.AudioVisualizationEnabled = legacy["desktopLyric.audioVisualization"]?.GetValue<bool>() ?? settings.AudioVisualizationEnabled;
            settings.DataRoot = Path.Combine(Path.GetDirectoryName(legacyPath)!, "lx.data.db");
            settings.LegacySettingsImported = true;
        }
        catch (Exception) when (File.Exists(legacyPath))
        {
            // Keep safe defaults if an old installation has a partially written config.
        }
        return settings;
    }
}
