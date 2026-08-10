using Windows.Media.Audio;
using Windows.Media;
using Windows.Media.Core;
using Windows.Media.MediaProperties;
using Windows.Media.Render;
using Windows.Storage;

var wavePath = Path.Combine(Path.GetTempPath(), "lxta-audio-smoke.wav");
CreateWave(wavePath);
var settings = new AudioGraphSettings(AudioRenderCategory.Media)
{
    QuantumSizeSelectionMode = QuantumSizeSelectionMode.ClosestToDesired,
    DesiredSamplesPerQuantum = 1024,
};
var result = await AudioGraph.CreateAsync(settings);
Console.WriteLine($"graph:{result.Status}");
if (result.Graph is not null)
{
    var output = await result.Graph.CreateDeviceOutputNodeAsync();
    Console.WriteLine($"output:{output.Status}");
    var file = await StorageFile.GetFileFromPathAsync(wavePath);
    var input = await result.Graph.CreateFileInputNodeAsync(file);
    Console.WriteLine($"input:{input.Status}");
    if (input.FileInputNode is not null && output.DeviceOutputNode is not null)
    {
        var frame = result.Graph.CreateFrameOutputNode(AudioEncodingProperties.CreatePcm(result.Graph.EncodingProperties.SampleRate, 2, 16));
        var frameLength = 0u;
        result.Graph.QuantumProcessed += (_, _) =>
        {
            try
            {
                using var audioFrame = frame.GetFrame();
                using var audioBuffer = audioFrame.LockBuffer(AudioBufferAccessMode.Read);
                frameLength = audioBuffer.Length;
            }
            catch { }
        };
        var effect = new EqualizerEffectDefinition(result.Graph);
        Console.WriteLine($"bands:{effect.Bands.Count}");
        if (effect.Bands.Count > 0) effect.Bands[0].Gain = 6;
        input.FileInputNode.EffectDefinitions.Add(effect);
        input.FileInputNode.OutgoingGain = 0;
        input.FileInputNode.AddOutgoingConnection(output.DeviceOutputNode);
        input.FileInputNode.AddOutgoingConnection(frame);
        result.Graph.Start();
        await Task.Delay(200);
        result.Graph.Stop();
        Console.WriteLine($"frameBytes:{frameLength}");
        frame.Dispose();
        input.FileInputNode.Dispose();
    }
    result.Graph.Dispose();
}
File.Delete(wavePath);

static void CreateWave(string path)
{
    const int sampleRate = 48000;
    const int frames = 12000;
    using var stream = File.Create(path);
    using var writer = new BinaryWriter(stream);
    var dataBytes = frames * 2 * sizeof(short);
    writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
    writer.Write(36 + dataBytes);
    writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));
    writer.Write(16); writer.Write((short)1); writer.Write((short)2); writer.Write(sampleRate);
    writer.Write(sampleRate * 4); writer.Write((short)4); writer.Write((short)16);
    writer.Write(System.Text.Encoding.ASCII.GetBytes("data")); writer.Write(dataBytes);
    for (var i = 0; i < frames; i++)
    {
        var sample = (short)(12000 * Math.Sin(2 * Math.PI * 440 * i / sampleRate));
        writer.Write(sample); writer.Write(sample);
    }
}
