using System.Text.Json;

namespace LXTA_Native.Services;

public sealed class LocalizationService
{
    private readonly Dictionary<string, string> simplifiedToKey = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Dictionary<string, string>> resources = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Dictionary<string, string>> custom = new(StringComparer.OrdinalIgnoreCase)
    {
        ["zh-cn"] = new() { ["首页"] = "首页", ["我的歌单"] = "我的歌单", ["本地音乐"] = "本地音乐", ["下载管理"] = "下载管理", ["设置"] = "设置", ["音效"] = "音效", ["十段均衡器"] = "十段均衡器", ["原生混响"] = "原生混响", ["回声比例"] = "回声比例", ["回声延迟（毫秒）"] = "回声延迟（毫秒）", ["回声反馈"] = "回声反馈", ["播放器实时频谱"] = "播放器实时频谱", ["语言"] = "语言", ["搜索歌曲、歌手或专辑"] = "搜索歌曲、歌手或专辑", ["欢迎回来"] = "欢迎回来", ["最近播放"] = "最近播放", ["音频输出"] = "音频输出", ["功能"] = "功能", ["同步"] = "同步" },
        ["zh-tw"] = new() { ["首页"] = "首頁", ["我的歌单"] = "我的歌單", ["本地音乐"] = "本地音樂", ["下载管理"] = "下載管理", ["设置"] = "設定", ["音效"] = "音效", ["十段均衡器"] = "十段等化器", ["原生混响"] = "原生混響", ["回声比例"] = "回聲比例", ["回声延迟（毫秒）"] = "回聲延遲（毫秒）", ["回声反馈"] = "回聲回饋", ["播放器实时频谱"] = "播放器即時頻譜", ["语言"] = "語言", ["搜索歌曲、歌手或专辑"] = "搜尋歌曲、歌手或專輯", ["欢迎回来"] = "歡迎回來", ["最近播放"] = "最近播放", ["音频输出"] = "音訊輸出", ["功能"] = "功能", ["同步"] = "同步" },
        ["en-us"] = new() { ["首页"] = "Home", ["我的歌单"] = "My playlists", ["本地音乐"] = "Local music", ["下载管理"] = "Downloads", ["设置"] = "Settings", ["音效"] = "Audio effects", ["十段均衡器"] = "10-band equalizer", ["原生混响"] = "Reverb", ["回声比例"] = "Echo mix", ["回声延迟（毫秒）"] = "Echo delay (ms)", ["回声反馈"] = "Echo feedback", ["播放器实时频谱"] = "Live spectrum", ["语言"] = "Language", ["搜索歌曲、歌手或专辑"] = "Search songs, artists or albums", ["欢迎回来"] = "Welcome back", ["最近播放"] = "Recently played", ["音频输出"] = "Audio output", ["功能"] = "Features", ["同步"] = "Sync" },
    };
    private string locale = "zh-cn";

    public string Locale => locale;
    public IReadOnlyList<(string Id, string Name)> Languages { get; } =
    [
        ("zh-cn", "简体中文"),
        ("zh-tw", "繁體中文"),
        ("en-us", "English"),
    ];

    public LocalizationService()
    {
        LoadResource("zh-cn");
        LoadResource("zh-tw");
        LoadResource("en-us");
        if (resources.TryGetValue("zh-cn", out var simplified))
            foreach (var pair in simplified) simplifiedToKey.TryAdd(pair.Value, pair.Key);
    }

    public void SetLocale(string? value) => locale = Languages.Any(item => item.Id.Equals(value, StringComparison.OrdinalIgnoreCase)) ? value!.ToLowerInvariant() : "zh-cn";

    public string Translate(string text)
    {
        if (custom.TryGetValue(locale, out var customCurrent) && customCurrent.TryGetValue(text, out var customValue)) return customValue;
        if (!simplifiedToKey.TryGetValue(text, out var key))
        {
            foreach (var values in resources.Values)
            {
                var pair = values.FirstOrDefault(item => item.Value == text);
                if (!string.IsNullOrEmpty(pair.Key)) { key = pair.Key; break; }
            }
        }
        if (string.IsNullOrEmpty(key)) return text;
        return resources.TryGetValue(locale, out var current) && current.TryGetValue(key, out var translated) ? translated : text;
    }

    private void LoadResource(string id)
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Assets", "i18n", $"{id}.json");
            if (!File.Exists(path)) return;
            var values = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path));
            if (values is not null) resources[id] = values;
        }
        catch { }
    }
}
