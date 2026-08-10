using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace LXTA_Native.Services;

public sealed record ThemeInfo(string Id, string Name, bool IsDark, string Primary);

public sealed class ThemeService
{
    private static readonly Regex Rgb = new("rgba?\\(\\s*(?<r>\\d+)\\s*,\\s*(?<g>\\d+)\\s*,\\s*(?<b>\\d+)(?:\\s*,\\s*(?<a>[0-9.]+))?\\s*\\)", RegexOptions.Compiled);
    public IReadOnlyList<ThemeInfo> Themes { get; } = LoadThemes();

    public void Apply(string id)
    {
        var theme = Themes.FirstOrDefault(x => x.Id == id) ?? Themes.FirstOrDefault(x => x.Id == "green");
        if (theme is null) return;
        var color = ParseColor(theme.Primary);
        Application.Current.Resources["AccentFillColorDefaultBrush"] = new SolidColorBrush(color);
        Application.Current.Resources["AccentFillColorSecondaryBrush"] = new SolidColorBrush(Color.FromArgb(150, color.R, color.G, color.B));
        if (App.MainWindow.Content is FrameworkElement root) root.RequestedTheme = theme.IsDark ? ElementTheme.Dark : ElementTheme.Light;
    }

    private static IReadOnlyList<ThemeInfo> LoadThemes()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "themes.json");
        if (!File.Exists(path)) return new[] { new ThemeInfo("green", "绿意盎然", false, "rgb(77,175,124)") };
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var themes = document.RootElement.EnumerateArray().Select(item => new ThemeInfo(
                item.GetProperty("id").GetString() ?? "green",
                item.GetProperty("name").GetString() ?? "",
                item.GetProperty("isDark").GetBoolean(),
                item.GetProperty("config").GetProperty("themeColors").GetProperty("--color-primary").GetString() ?? "rgb(77,175,124)"))
                .ToList();
            var customPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "LX-TA", "LxDatas", "theme.json");
            if (File.Exists(customPath))
            {
                using var customDocument = JsonDocument.Parse(File.ReadAllText(customPath));
                if (customDocument.RootElement.TryGetProperty("themes", out var customThemes))
                {
                    foreach (var item in customThemes.EnumerateArray()) themes.Add(new ThemeInfo(
                        item.GetProperty("id").GetString() ?? $"custom_{themes.Count}",
                        item.GetProperty("name").GetString() ?? "自定义主题",
                        item.TryGetProperty("isDark", out var dark) && dark.GetBoolean(),
                        item.GetProperty("config").GetProperty("themeColors").GetProperty("--color-primary").GetString() ?? "rgb(77,175,124)"));
                }
            }
            return themes;
        }
        catch (JsonException) { return new[] { new ThemeInfo("green", "绿意盎然", false, "rgb(77,175,124)") }; }
    }

    private static Color ParseColor(string value)
    {
        if (value.StartsWith('#') && (value.Length == 7 || value.Length == 9))
        {
            var offset = value.Length == 9 ? 3 : 1;
            var hexAlpha = value.Length == 9 ? Convert.ToByte(value.Substring(1, 2), 16) : (byte)255;
            return Color.FromArgb(hexAlpha, Convert.ToByte(value.Substring(offset, 2), 16), Convert.ToByte(value.Substring(offset + 2, 2), 16), Convert.ToByte(value.Substring(offset + 4, 2), 16));
        }
        var match = Rgb.Match(value);
        if (!match.Success) return Color.FromArgb(255, 77, 175, 124);
        var alpha = match.Groups["a"].Success ? (byte)(double.Parse(match.Groups["a"].Value) * 255) : (byte)255;
        return Color.FromArgb(alpha, byte.Parse(match.Groups["r"].Value), byte.Parse(match.Groups["g"].Value), byte.Parse(match.Groups["b"].Value));
    }
}
