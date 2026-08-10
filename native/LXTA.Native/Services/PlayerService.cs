using System.Diagnostics;
using System.Numerics;
using System.Runtime.InteropServices;
using LXTA_Native.Models;
using Windows.Media;
using Windows.Media.Audio;
using Windows.Media.Core;
using Windows.Media.MediaProperties;
using Windows.Media.Playback;
using Windows.Media.Render;
using Windows.Devices.Enumeration;
using Windows.Media.Devices;

namespace LXTA_Native.Services;

public sealed class PlayerService : IDisposable
{
    private static readonly double[] EqualizerFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    private readonly MediaPlayer transportPlayer = new();
    private readonly List<Track> queue = new();
    private readonly SemaphoreSlim graphGate = new(1, 1);
    private readonly Stopwatch spectrumClock = Stopwatch.StartNew();
    private AudioGraph? graph;
    private AudioDeviceOutputNode? outputNode;
    private AudioFrameOutputNode? frameOutputNode;
    private MediaSourceAudioInputNode? inputNode;
    private readonly List<EqualizerEffectDefinition> equalizerEffects = new();
    private ReverbEffectDefinition? reverbEffect;
    private EchoEffectDefinition? echoEffect;
    private int currentIndex = -1;
    private bool isPlaying;
    private bool usingFallbackMediaPlayer;
    private double volume = 1;
    private double playbackRate = 1;
    private bool equalizerEnabled;
    private readonly double[] equalizerGains = new double[10];
    private double reverbMix;
    private double echoMix;
    private double echoDelay = 180;
    private double echoFeedback = 20;
    private bool visualizationEnabled = true;
    private string audioDeviceId = string.Empty;
    private long lastSpectrumMilliseconds;

    public PlayerService(SettingsService _)
    {
        transportPlayer.AutoPlay = false;
        transportPlayer.MediaEnded += async (_, _) =>
        {
            if (usingFallbackMediaPlayer)
            {
                SetPlaying(false);
                if (Mode == PlaybackMode.SingleLoop && CurrentTrack is not null) await OpenAndPlayAsync(CurrentTrack);
                else await NextAsync();
            }
        };
        transportPlayer.MediaFailed += (_, args) => PlaybackFailed?.Invoke(this, args.ErrorMessage);
        var controls = transportPlayer.SystemMediaTransportControls;
        controls.IsPlayEnabled = true;
        controls.IsPauseEnabled = true;
        controls.IsStopEnabled = true;
        controls.IsNextEnabled = true;
        controls.IsPreviousEnabled = true;
        controls.ButtonPressed += async (_, args) =>
        {
            switch (args.Button)
            {
                case SystemMediaTransportControlsButton.Play: Play(); break;
                case SystemMediaTransportControlsButton.Pause: Pause(); break;
                case SystemMediaTransportControlsButton.Stop: Stop(); break;
                case SystemMediaTransportControlsButton.Next: await NextAsync(); break;
                case SystemMediaTransportControlsButton.Previous: await PreviousAsync(); break;
            }
        };
    }

    public event EventHandler<Track?>? CurrentTrackChanged;
    public event EventHandler? PlaybackStateChanged;
    public event EventHandler<string>? PlaybackFailed;
    public event EventHandler<float[]>? SpectrumChanged;

    public Track? CurrentTrack { get; private set; }
    public IReadOnlyList<Track> Queue => queue;
    public MediaPlayer MediaPlayer => transportPlayer;
    public bool IsPlaying => isPlaying;
    public double Volume
    {
        get => volume;
        set
        {
            volume = Math.Clamp(value, 0, 1);
            if (inputNode is not null) inputNode.OutgoingGain = volume;
            transportPlayer.Volume = volume;
        }
    }
    public double PlaybackRate
    {
        get => playbackRate;
        set
        {
            playbackRate = Math.Clamp(value, 0.5, 2);
            if (inputNode is not null) inputNode.PlaybackSpeedFactor = playbackRate;
            if (usingFallbackMediaPlayer) transportPlayer.PlaybackSession.PlaybackRate = playbackRate;
        }
    }
    public TimeSpan Position => usingFallbackMediaPlayer ? transportPlayer.PlaybackSession.Position : inputNode?.Position ?? TimeSpan.Zero;
    public TimeSpan Duration => usingFallbackMediaPlayer ? transportPlayer.PlaybackSession.NaturalDuration : inputNode?.Duration ?? TimeSpan.Zero;
    public PlaybackMode Mode { get; set; } = PlaybackMode.ListLoop;
    public string AudioDeviceId => audioDeviceId;
    public bool VisualizationEnabled
    {
        get => visualizationEnabled;
        set
        {
            visualizationEnabled = value;
            if (!value) SpectrumChanged?.Invoke(this, new float[32]);
        }
    }

    public void ConfigureEffects(bool enableEqualizer, IReadOnlyList<double>? gains, double reverbWetMix, double echoWetMix, double delayMilliseconds, double feedback)
    {
        equalizerEnabled = enableEqualizer;
        for (var i = 0; i < equalizerGains.Length; i++) equalizerGains[i] = gains is not null && i < gains.Count ? Math.Clamp(gains[i], -12, 12) : 0;
        reverbMix = Math.Clamp(reverbWetMix, 0, 100);
        echoMix = Math.Clamp(echoWetMix, 0, 100);
        echoDelay = Math.Clamp(delayMilliseconds, 1, 2000);
        echoFeedback = Math.Clamp(feedback, 0, 99);
        ApplyEffectValues();
    }

    public async Task SetAudioDeviceAsync(string? deviceId)
    {
        audioDeviceId = deviceId ?? string.Empty;
        if (graph is null) return;
        var wasPlaying = isPlaying;
        graph.Stop();
        DisposeInputNode();
        frameOutputNode?.Dispose();
        outputNode?.Dispose();
        graph.QuantumProcessed -= Graph_QuantumProcessed;
        graph.Dispose();
        graph = null;
        frameOutputNode = null;
        outputNode = null;
        if (wasPlaying && CurrentTrack is not null) await PlayAsync(CurrentTrack, queue.ToArray());
    }

    public void SetEqualizerEnabled(bool value)
    {
        equalizerEnabled = value;
        ApplyEffectValues();
    }

    public void SetEqualizerGain(int index, double gain)
    {
        if ((uint)index >= equalizerGains.Length) return;
        equalizerGains[index] = Math.Clamp(gain, -12, 12);
        ApplyEffectValues();
    }

    public void SetReverbMix(double value) { reverbMix = Math.Clamp(value, 0, 100); ApplyEffectValues(); }
    public void SetEcho(double mix, double delayMilliseconds, double feedback)
    {
        echoMix = Math.Clamp(mix, 0, 100);
        echoDelay = Math.Clamp(delayMilliseconds, 1, 2000);
        echoFeedback = Math.Clamp(feedback, 0, 99);
        ApplyEffectValues();
    }

    public void SetQueue(IEnumerable<Track> tracks, Track? selected = null)
    {
        queue.Clear();
        queue.AddRange(tracks);
        currentIndex = selected is null ? (queue.Count > 0 ? 0 : -1) : queue.FindIndex(x => x.Id == selected.Id);
        if (currentIndex < 0 && queue.Count > 0) currentIndex = 0;
    }

    public async Task<bool> PlayAsync(Track track, IEnumerable<Track>? sourceQueue = null)
    {
        if (sourceQueue is not null) SetQueue(sourceQueue, track);
        else
        {
            currentIndex = queue.FindIndex(x => x.Id == track.Id);
            if (currentIndex < 0) { queue.Add(track); currentIndex = queue.Count - 1; }
        }
        return await OpenAndPlayAsync(track);
    }

    public async Task<bool> NextAsync()
    {
        if (queue.Count == 0) return false;
        currentIndex = Mode == PlaybackMode.Shuffle && queue.Count > 1
            ? PickRandomIndex(currentIndex, queue.Count)
            : (currentIndex + 1 + queue.Count) % queue.Count;
        return await OpenAndPlayAsync(queue[currentIndex]);
    }

    public async Task<bool> PreviousAsync()
    {
        if (Position > TimeSpan.FromSeconds(5))
        {
            if (usingFallbackMediaPlayer) transportPlayer.PlaybackSession.Position = TimeSpan.Zero;
            else inputNode?.Seek(TimeSpan.Zero);
            return true;
        }
        if (queue.Count == 0) return false;
        currentIndex = Mode == PlaybackMode.Shuffle && queue.Count > 1
            ? PickRandomIndex(currentIndex, queue.Count)
            : (currentIndex - 1 + queue.Count) % queue.Count;
        return await OpenAndPlayAsync(queue[currentIndex]);
    }

    public void Toggle() { if (isPlaying) Pause(); else if (CurrentTrack is not null) Play(); }

    public void Play()
    {
        if (usingFallbackMediaPlayer) { transportPlayer.Play(); SetPlaying(true); return; }
        if (inputNode is null || graph is null) return;
        inputNode.Start();
        graph.Start();
        SetPlaying(true);
    }

    public void Pause()
    {
        if (usingFallbackMediaPlayer) { transportPlayer.Pause(); SetPlaying(false); return; }
        inputNode?.Stop();
        SetPlaying(false);
    }

    public void Seek(double fraction)
    {
        if (Duration <= TimeSpan.Zero) return;
        var position = TimeSpan.FromTicks((long)(Duration.Ticks * Math.Clamp(fraction, 0, 1)));
        if (usingFallbackMediaPlayer) transportPlayer.PlaybackSession.Position = position;
        else inputNode?.Seek(position);
    }

    public void Stop()
    {
        if (usingFallbackMediaPlayer)
        {
            transportPlayer.Pause();
            transportPlayer.PlaybackSession.Position = TimeSpan.Zero;
            SetPlaying(false);
            return;
        }
        if (inputNode is not null)
        {
            inputNode.Stop();
            inputNode.Reset();
        }
        SetPlaying(false);
    }

    private async Task EnsureGraphAsync()
    {
        if (graph is not null) return;
        var settings = new AudioGraphSettings(AudioRenderCategory.Media)
        {
            QuantumSizeSelectionMode = QuantumSizeSelectionMode.ClosestToDesired,
            DesiredSamplesPerQuantum = 1024,
        };
        if (!string.IsNullOrWhiteSpace(audioDeviceId))
        {
            var devices = await DeviceInformation.FindAllAsync(MediaDevice.GetAudioRenderSelector());
            settings.PrimaryRenderDevice = devices.FirstOrDefault(item => item.Id == audioDeviceId);
        }
        var graphResult = await AudioGraph.CreateAsync(settings);
        if (graphResult.Status != AudioGraphCreationStatus.Success) throw new InvalidOperationException($"无法创建 Windows 音频图：{graphResult.Status}");
        graph = graphResult.Graph;
        graph.UnrecoverableErrorOccurred += (_, args) => PlaybackFailed?.Invoke(this, $"Windows 音频图发生不可恢复错误：{args.Error}");

        var outputResult = await graph.CreateDeviceOutputNodeAsync();
        if (outputResult.Status != AudioDeviceNodeCreationStatus.Success) throw new InvalidOperationException($"无法打开默认音频输出设备：{outputResult.Status}");
        outputNode = outputResult.DeviceOutputNode;

        var pcm = AudioEncodingProperties.CreatePcm(graph.EncodingProperties.SampleRate, 2, 16);
        frameOutputNode = graph.CreateFrameOutputNode(pcm);
        graph.QuantumProcessed += Graph_QuantumProcessed;
    }

    private async Task<bool> OpenAndPlayAsync(Track track)
    {
        string? mediaUri = track.FilePath;
        if (!string.IsNullOrWhiteSpace(mediaUri) && !File.Exists(mediaUri)) mediaUri = null;
        if (string.IsNullOrWhiteSpace(mediaUri))
        {
            try
            {
                if (NativeAppServices.UserApis.IsRunning)
                {
                    var result = await NativeAppServices.UserApis.RequestAsync(track.Source, "musicUrl", new { type = "320k", musicInfo = track });
                    if (result is not null && result.Data.TryGetProperty("data", out var data) && data.TryGetProperty("url", out var url)) mediaUri = url.GetString();
                }
                if (string.IsNullOrWhiteSpace(mediaUri) && track.Source == "kw") mediaUri = await NativeAppServices.Online.ResolveKuwoUrlAsync(track);
                if (string.IsNullOrWhiteSpace(mediaUri) && track.Source == "bili") mediaUri = await NativeAppServices.Online.ResolveBiliUrlAsync(track);
            }
            catch (Exception ex) { PlaybackFailed?.Invoke(this, ex.Message); }
        }
        if (string.IsNullOrWhiteSpace(mediaUri))
        {
            PlaybackFailed?.Invoke(this, $"无法解析音源：{track.Name}");
            return false;
        }

        await graphGate.WaitAsync();
        try
        {
            await EnsureGraphAsync();
            graph!.Stop();
            transportPlayer.Pause();
            transportPlayer.Source = null;
            DisposeInputNode();
            usingFallbackMediaPlayer = false;

            var source = MediaSource.CreateFromUri(new Uri(mediaUri));
            var inputResult = await graph.CreateMediaSourceAudioInputNodeAsync(source);
            if (inputResult.Status != MediaSourceAudioInputNodeCreationStatus.Success)
            {
                return StartFallbackMediaPlayer(track, mediaUri, $"音频图不支持该音频格式（{inputResult.Status}），已切换兼容播放模式");
            }

            inputNode = inputResult.Node;
            inputNode.OutgoingGain = volume;
            inputNode.PlaybackSpeedFactor = playbackRate;
            inputNode.MediaSourceCompleted += InputNode_MediaSourceCompleted;
            BuildEffects();
            inputNode.AddOutgoingConnection(outputNode!);
            inputNode.AddOutgoingConnection(frameOutputNode!);

            CurrentTrack = track;
            UpdateTransportMetadata(track);
            CurrentTrackChanged?.Invoke(this, track);
            inputNode.Start();
            graph.Start();
            SetPlaying(true);
            return true;
        }
        catch (Exception ex)
        {
            return StartFallbackMediaPlayer(track, mediaUri, $"原生音频图不可用，已切换兼容播放模式：{ex.Message}");
        }
        finally { graphGate.Release(); }
    }

    private bool StartFallbackMediaPlayer(Track track, string mediaUri, string notice)
    {
        try
        {
            DisposeInputNode();
            usingFallbackMediaPlayer = true;
            transportPlayer.Source = MediaSource.CreateFromUri(new Uri(mediaUri));
            transportPlayer.Volume = volume;
            transportPlayer.PlaybackSession.PlaybackRate = playbackRate;
            CurrentTrack = track;
            UpdateTransportMetadata(track);
            CurrentTrackChanged?.Invoke(this, track);
            transportPlayer.Play();
            SetPlaying(true);
            PlaybackFailed?.Invoke(this, notice);
            return true;
        }
        catch (Exception ex)
        {
            PlaybackFailed?.Invoke(this, ex.Message);
            return false;
        }
    }

    private async void InputNode_MediaSourceCompleted(MediaSourceAudioInputNode sender, object args)
    {
        if (sender != inputNode) return;
        SetPlaying(false);
        if (Mode == PlaybackMode.SingleLoop && CurrentTrack is not null) await OpenAndPlayAsync(CurrentTrack);
        else await NextAsync();
    }

    private void BuildEffects()
    {
        if (graph is null || inputNode is null) return;
        equalizerEffects.Clear();
        for (var effectIndex = 0; effectIndex < 3; effectIndex++)
        {
            var definition = new EqualizerEffectDefinition(graph);
            for (var bandIndex = 0; bandIndex < definition.Bands.Count; bandIndex++)
            {
                var valueIndex = effectIndex * definition.Bands.Count + bandIndex;
                if (valueIndex >= EqualizerFrequencies.Length) break;
                var band = definition.Bands[bandIndex];
                band.FrequencyCenter = EqualizerFrequencies[valueIndex];
                band.Bandwidth = 1;
            }
            inputNode.EffectDefinitions.Add(definition);
            equalizerEffects.Add(definition);
        }

        reverbEffect = new ReverbEffectDefinition(graph);
        inputNode.EffectDefinitions.Add(reverbEffect);
        echoEffect = new EchoEffectDefinition(graph);
        inputNode.EffectDefinitions.Add(echoEffect);
        ApplyEffectValues();
    }

    private void ApplyEffectValues()
    {
        var input = inputNode;
        if (input is null) return;
        for (var effectIndex = 0; effectIndex < equalizerEffects.Count; effectIndex++)
        {
            var definition = equalizerEffects[effectIndex];
            for (var bandIndex = 0; bandIndex < definition.Bands.Count; bandIndex++)
            {
                var valueIndex = effectIndex * definition.Bands.Count + bandIndex;
                definition.Bands[bandIndex].Gain = equalizerEnabled && valueIndex < equalizerGains.Length ? equalizerGains[valueIndex] : 0;
            }
            if (equalizerEnabled) input.EnableEffectsByDefinition(definition); else input.DisableEffectsByDefinition(definition);
        }
        if (reverbEffect is not null)
        {
            reverbEffect.WetDryMix = reverbMix;
            if (reverbMix > 0) input.EnableEffectsByDefinition(reverbEffect); else input.DisableEffectsByDefinition(reverbEffect);
        }
        if (echoEffect is not null)
        {
            echoEffect.WetDryMix = echoMix;
            echoEffect.Delay = echoDelay;
            echoEffect.Feedback = echoFeedback;
            if (echoMix > 0) input.EnableEffectsByDefinition(echoEffect); else input.DisableEffectsByDefinition(echoEffect);
        }
    }

    private unsafe void Graph_QuantumProcessed(AudioGraph sender, object args)
    {
        if (!visualizationEnabled || !isPlaying || frameOutputNode is null) return;
        var elapsed = spectrumClock.ElapsedMilliseconds;
        if (elapsed - Interlocked.Read(ref lastSpectrumMilliseconds) < 45) return;
        Interlocked.Exchange(ref lastSpectrumMilliseconds, elapsed);
        try
        {
            using var frame = frameOutputNode.GetFrame();
            using var buffer = frame.LockBuffer(AudioBufferAccessMode.Read);
            using var reference = buffer.CreateReference();
            ((IMemoryBufferByteAccess)reference).GetBuffer(out var data, out _);
            var sampleCount = (int)buffer.Length / sizeof(short);
            if (sampleCount < 128) return;
            var monoCount = Math.Min(1024, sampleCount / 2);
            var startFrame = sampleCount / 2 - monoCount;
            var values = new Complex[1024];
            var pcm = (short*)data;
            for (var i = 0; i < monoCount; i++)
            {
                var sampleIndex = (startFrame + i) * 2;
                var mono = (pcm[sampleIndex] + pcm[sampleIndex + 1]) / 65536.0;
                var window = 0.5 - 0.5 * Math.Cos(2 * Math.PI * i / Math.Max(1, monoCount - 1));
                values[i] = new Complex(mono * window, 0);
            }
            FastFourierTransform(values);
            var spectrum = CreateLogSpectrum(values, sender.EncodingProperties.SampleRate);
            SpectrumChanged?.Invoke(this, spectrum);
        }
        catch { /* 音频设备切换时当前帧可能暂时不可用 */ }
    }

    private static float[] CreateLogSpectrum(Complex[] fft, uint sampleRate)
    {
        var result = new float[32];
        const double minFrequency = 35;
        var maxFrequency = Math.Min(18000, sampleRate / 2.0);
        for (var band = 0; band < result.Length; band++)
        {
            var low = minFrequency * Math.Pow(maxFrequency / minFrequency, band / (double)result.Length);
            var high = minFrequency * Math.Pow(maxFrequency / minFrequency, (band + 1) / (double)result.Length);
            var start = Math.Clamp((int)(low * fft.Length / sampleRate), 1, fft.Length / 2 - 1);
            var end = Math.Clamp((int)Math.Ceiling(high * fft.Length / sampleRate), start + 1, fft.Length / 2);
            double peak = 0;
            for (var i = start; i < end; i++) peak = Math.Max(peak, fft[i].Magnitude);
            var db = 20 * Math.Log10(Math.Max(peak / (fft.Length * 0.35), 0.00001));
            result[band] = (float)Math.Clamp((db + 70) / 70, 0, 1);
        }
        return result;
    }

    private static void FastFourierTransform(Complex[] buffer)
    {
        var n = buffer.Length;
        for (int i = 1, j = 0; i < n; i++)
        {
            var bit = n >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (j > i) (buffer[i], buffer[j]) = (buffer[j], buffer[i]);
        }
        for (var length = 2; length <= n; length <<= 1)
        {
            var angle = -2 * Math.PI / length;
            var root = new Complex(Math.Cos(angle), Math.Sin(angle));
            for (var i = 0; i < n; i += length)
            {
                var factor = Complex.One;
                for (var j = 0; j < length / 2; j++)
                {
                    var even = buffer[i + j];
                    var odd = buffer[i + j + length / 2] * factor;
                    buffer[i + j] = even + odd;
                    buffer[i + j + length / 2] = even - odd;
                    factor *= root;
                }
            }
        }
    }

    private void UpdateTransportMetadata(Track track)
    {
        var controls = transportPlayer.SystemMediaTransportControls;
        controls.PlaybackStatus = MediaPlaybackStatus.Playing;
        var updater = controls.DisplayUpdater;
        updater.Type = MediaPlaybackType.Music;
        updater.MusicProperties.Title = track.Name;
        updater.MusicProperties.Artist = track.Singer;
        updater.MusicProperties.AlbumTitle = track.AlbumName ?? string.Empty;
        updater.Update();
    }

    private void SetPlaying(bool value)
    {
        if (isPlaying == value) return;
        isPlaying = value;
        transportPlayer.SystemMediaTransportControls.PlaybackStatus = value ? MediaPlaybackStatus.Playing : MediaPlaybackStatus.Paused;
        PlaybackStateChanged?.Invoke(this, EventArgs.Empty);
    }

    private void DisposeInputNode()
    {
        if (inputNode is null) return;
        inputNode.MediaSourceCompleted -= InputNode_MediaSourceCompleted;
        inputNode.Dispose();
        inputNode = null;
        equalizerEffects.Clear();
        reverbEffect = null;
        echoEffect = null;
        usingFallbackMediaPlayer = false;
    }

    private static int PickRandomIndex(int current, int count)
    {
        var next = Random.Shared.Next(count - 1);
        return next >= current ? next + 1 : next;
    }

    public void Dispose()
    {
        DisposeInputNode();
        if (graph is not null) graph.QuantumProcessed -= Graph_QuantumProcessed;
        frameOutputNode?.Dispose();
        outputNode?.Dispose();
        graph?.Dispose();
        transportPlayer.Dispose();
        graphGate.Dispose();
    }

    [ComImport]
    [Guid("5B0D3235-4DBA-4D44-865E-8F1D0E4FD04D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private unsafe interface IMemoryBufferByteAccess
    {
        void GetBuffer(out byte* buffer, out uint capacity);
    }
}
