using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;

namespace LXTA_Native.Controls;

public sealed partial class SpectrumVisualizer : UserControl
{
    private const int BarCount = 32;
    private readonly Rectangle[] bars = new Rectangle[BarCount];
    private readonly float[] displayed = new float[BarCount];
    private readonly float[] target = new float[BarCount];
    private readonly DispatcherTimer animationTimer = new() { Interval = TimeSpan.FromMilliseconds(33) };

    public SpectrumVisualizer()
    {
        InitializeComponent();
        for (var i = 0; i < BarCount; i++)
        {
            bars[i] = new Rectangle
            {
                RadiusX = 2,
                RadiusY = 2,
                Fill = (Brush)Application.Current.Resources["AccentFillColorDefaultBrush"],
                Opacity = 0.72,
            };
            BarsCanvas.Children.Add(bars[i]);
        }
        animationTimer.Tick += (_, _) => Animate();
        Loaded += (_, _) => animationTimer.Start();
        Unloaded += (_, _) => animationTimer.Stop();
    }

    public void SetSpectrum(IReadOnlyList<float> values)
    {
        for (var i = 0; i < BarCount; i++) target[i] = i < values.Count ? Math.Clamp(values[i], 0, 1) : 0;
    }

    public void Clear() => Array.Clear(target);

    private void Animate()
    {
        for (var i = 0; i < BarCount; i++)
        {
            var response = target[i] > displayed[i] ? 0.58f : 0.14f;
            displayed[i] += (target[i] - displayed[i]) * response;
        }
        LayoutBars();
    }

    private void BarsCanvas_SizeChanged(object sender, SizeChangedEventArgs e) => LayoutBars();

    private void LayoutBars()
    {
        if (ActualWidth <= 0 || ActualHeight <= 0) return;
        const double gap = 2;
        var width = Math.Max(1, (ActualWidth - gap * (BarCount - 1)) / BarCount);
        for (var i = 0; i < BarCount; i++)
        {
            var height = Math.Max(2, displayed[i] * ActualHeight);
            bars[i].Width = width;
            bars[i].Height = height;
            Canvas.SetLeft(bars[i], i * (width + gap));
            Canvas.SetTop(bars[i], ActualHeight - height);
        }
    }
}
