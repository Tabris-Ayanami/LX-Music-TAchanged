using System.Text.Json;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using LXTA_Native.Models;

namespace LXTA_Native.Services;

public sealed class OnlineSearchService
{
    private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(12) };
    private static readonly Regex InfoRegex = new("level:(\\w+),bitrate:(\\d+),format:(\\w+),size:([\\w.]+)", RegexOptions.Compiled);

    public async Task<IReadOnlyList<Track>> SearchAllAsync(string text, int limitPerSource = 12, CancellationToken cancellationToken = default)
    {
        var searches = new Func<Task<IReadOnlyList<Track>>>[]
        {
            () => SearchKuwoAsync(text, limitPerSource, cancellationToken),
            () => SearchKugouAsync(text, limitPerSource, cancellationToken),
            () => SearchQqAsync(text, limitPerSource, cancellationToken),
            () => SearchNeteaseAsync(text, limitPerSource, cancellationToken),
            () => SearchMiguAsync(text, limitPerSource, cancellationToken),
            () => SearchBiliAsync(text, limitPerSource, cancellationToken),
        };
        var results = await Task.WhenAll(searches.Select(async search => { try { return await search(); } catch { return Array.Empty<Track>(); } }));
        return results.SelectMany(items => items).DistinctBy(track => $"{track.Source}:{track.OnlineId}").ToArray();
    }

    public async Task<IReadOnlyList<Track>> SearchKuwoAsync(string text, int limit = 30, CancellationToken cancellationToken = default)
    {
        var url = $"http://search.kuwo.cn/r.s?client=kt&all={Uri.EscapeDataString(text)}&pn=0&rn={limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1";
        using var response = await http.GetAsync(url, cancellationToken); response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!document.RootElement.TryGetProperty("abslist", out var list) || list.ValueKind != JsonValueKind.Array) return Array.Empty<Track>();
        var result = new List<Track>();
        foreach (var item in list.EnumerateArray())
        {
            var id = item.TryGetProperty("MUSICRID", out var rid) ? rid.GetString()?.Replace("MUSIC_", "", StringComparison.OrdinalIgnoreCase) ?? "" : "";
            if (id.Length == 0) continue;
            var name = Decode(item, "SONGNAME"); var singer = Decode(item, "ARTIST"); var album = Decode(item, "ALBUM");
            var duration = item.TryGetProperty("DURATION", out var seconds) && int.TryParse(seconds.GetString(), out var value) ? TimeSpan.FromSeconds(value).ToString(@"m\:ss") : "";
            var metadata = new Dictionary<string, object?> { ["songmid"] = id, ["source"] = "kw", ["types"] = ParseQualities(item.TryGetProperty("N_MINFO", out var minfo) ? minfo.GetString() : null) };
            result.Add(new Track($"kw_{id}", name, singer, "kw", duration, null, album, null, JsonSerializer.Serialize(metadata)));
        }
        return result;
    }

    public async Task<string?> ResolveKuwoUrlAsync(Track track, CancellationToken cancellationToken = default)
    {
        var id = track.OnlineId; if (string.IsNullOrWhiteSpace(id)) return null;
        var url = $"https://www.kuwo.cn/api/v1/www/music/playUrl?mid={Uri.EscapeDataString(id)}&type=music&httpsStatus=1";
        using var request = new HttpRequestMessage(HttpMethod.Get, url); request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0");
        using var response = await http.SendAsync(request, cancellationToken); if (!response.IsSuccessStatusCode) return null; using var doc = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        return doc.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("url", out var result) ? result.GetString() : null;
    }

    public async Task<IReadOnlyList<Track>> SearchKugouAsync(string text, int limit = 30, CancellationToken cancellationToken = default)
    {
        var url = $"https://songsearch.kugou.com/song_search_v2?keyword={Uri.EscapeDataString(text)}&page=1&pagesize={limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1";
        using var response = await http.GetAsync(url, cancellationToken); response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!document.RootElement.TryGetProperty("data", out var data) || !data.TryGetProperty("lists", out var list)) return Array.Empty<Track>();
        var result = new List<Track>(); var ids = new HashSet<string>();
        foreach (var item in list.EnumerateArray())
        {
            AddKugou(item, result, ids);
            if (item.TryGetProperty("Grp", out var group) && group.ValueKind == JsonValueKind.Array) foreach (var child in group.EnumerateArray()) AddKugou(child, result, ids);
        }
        return result;
    }

    public async Task<IReadOnlyList<Track>> SearchQqAsync(string text, int limit = 30, CancellationToken cancellationToken = default)
    {
        var body = new
        {
            comm = new { ct = "11", cv = "14090508", v = "14090508", tmeAppID = "qqmusic", phonetype = "EBG-AN10", deviceScore = "553.47", devicelevel = "50", newdevicelevel = "20", rom = "HuaWei/EMOTION/EmotionUI_14.2.0", os_ver = "12", OpenUDID = "0", OpenUDID2 = "0", QIMEI36 = "0", udid = "0", chid = "0", aid = "0", oaid = "0", taid = "0", tid = "0", wid = "0", uid = "0", sid = "0", modeSwitch = "6", teenMode = "0", ui_mode = "2", nettype = "1020", v4ip = "" },
            req = new { module = "music.search.SearchCgiService", method = "DoSearchForQQMusicMobile", param = new { search_type = 0, query = text, page_num = 1, num_per_page = limit, highlight = 0, nqc_flag = 0, multi_zhida = 0, cat = 2, grp = 1, sin = 0, sem = 0 } },
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://u.y.qq.com/cgi-bin/musicu.fcg") { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") }; request.Headers.TryAddWithoutValidation("User-Agent", "QQMusic 14090508(android 12)");
        using var response = await http.SendAsync(request, cancellationToken); response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!TryPath(document.RootElement, out var list, "req", "data", "body", "item_song") || list.ValueKind != JsonValueKind.Array) return Array.Empty<Track>();
        var result = new List<Track>();
        foreach (var item in list.EnumerateArray())
        {
            var id = GetString(item, "mid"); if (id.Length == 0 || !item.TryGetProperty("file", out var file)) continue;
            var mediaMid = GetString(file, "media_mid"); if (mediaMid.Length == 0) continue;
            var singer = item.TryGetProperty("singer", out var singers) ? string.Join("、", singers.EnumerateArray().Select(value => GetString(value, "name")).Where(value => value.Length > 0)) : "";
            var albumName = item.TryGetProperty("album", out var album) ? GetString(album, "name") : ""; var albumId = item.TryGetProperty("album", out album) ? GetString(album, "mid") : "";
            var duration = FormatSeconds(GetInt(item, "interval"));
            var metadata = JsonSerializer.Serialize(new { songmid = id, songId = GetInt(item, "id"), strMediaMid = mediaMid, albumMid = albumId, source = "tx" });
            result.Add(new Track($"tx_{id}", GetString(item, "name") + GetString(item, "title_extra"), singer, "tx", duration, null, albumName, albumId.Length == 0 ? null : $"https://y.gtimg.cn/music/photo_new/T002R500x500M000{albumId}.jpg", metadata));
        }
        return result;
    }

    public async Task<IReadOnlyList<Track>> SearchNeteaseAsync(string text, int limit = 30, CancellationToken cancellationToken = default)
    {
        var url = $"https://music.163.com/api/search/get/web?csrf_token=&s={Uri.EscapeDataString(text)}&type=1&offset=0&total=true&limit={limit}";
        using var request = new HttpRequestMessage(HttpMethod.Get, url); request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0"); request.Headers.Referrer = new Uri("https://music.163.com/");
        using var response = await http.SendAsync(request, cancellationToken); response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!TryPath(document.RootElement, out var list, "result", "songs") || list.ValueKind != JsonValueKind.Array) return Array.Empty<Track>();
        var result = new List<Track>();
        foreach (var item in list.EnumerateArray())
        {
            var id = GetInt64(item, "id").ToString(); if (id == "0") continue;
            var singer = item.TryGetProperty("artists", out var artists) ? string.Join("、", artists.EnumerateArray().Select(value => GetString(value, "name")).Where(value => value.Length > 0)) : "";
            var albumName = item.TryGetProperty("album", out var album) ? GetString(album, "name") : ""; var picture = item.TryGetProperty("album", out album) ? GetString(album, "picUrl") : "";
            var duration = FormatSeconds((int)(GetInt64(item, "duration") / 1000)); var metadata = JsonSerializer.Serialize(new { songmid = id, source = "wy" });
            result.Add(new Track($"wy_{id}", GetString(item, "name"), singer, "wy", duration, null, albumName, picture, metadata));
        }
        return result;
    }

    public async Task<IReadOnlyList<Track>> SearchMiguAsync(string text, int limit = 20, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(); const string deviceId = "963B7AA0D21511ED807EE5846EC87D20";
        var signatureSource = $"{text}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50{deviceId}{timestamp}"; var sign = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(signatureSource))).ToLowerInvariant();
        var url = $"https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=%7B%22song%22%3A1%2C%22album%22%3A0%2C%22singer%22%3A0%2C%22tagSong%22%3A1%2C%22mvSong%22%3A0%2C%22bestShow%22%3A1%2C%22songlist%22%3A0%2C%22lyricSong%22%3A0%7D&pageSize={limit}&text={Uri.EscapeDataString(text)}&pageNo=1&sort=0&sid=USS";
        using var request = new HttpRequestMessage(HttpMethod.Get, url); request.Headers.TryAddWithoutValidation("uiVersion", "A_music_3.6.1"); request.Headers.TryAddWithoutValidation("deviceId", deviceId); request.Headers.TryAddWithoutValidation("timestamp", timestamp); request.Headers.TryAddWithoutValidation("sign", sign); request.Headers.TryAddWithoutValidation("channel", "0146921"); request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Linux; Android 11)");
        using var response = await http.SendAsync(request, cancellationToken); response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!TryPath(document.RootElement, out var groups, "songResultData", "resultList") || groups.ValueKind != JsonValueKind.Array) return Array.Empty<Track>();
        var result = new List<Track>(); var ids = new HashSet<string>();
        foreach (var group in groups.EnumerateArray()) foreach (var item in group.EnumerateArray())
        {
            var copyrightId = GetString(item, "copyrightId"); var id = GetString(item, "songId"); if (id.Length == 0 || copyrightId.Length == 0 || !ids.Add(copyrightId)) continue;
            var singer = item.TryGetProperty("singerList", out var singers) ? string.Join("、", singers.EnumerateArray().Select(value => GetString(value, "name")).Where(value => value.Length > 0)) : "";
            var picture = new[] { "img3", "img2", "img1" }.Select(key => GetString(item, key)).FirstOrDefault(value => value.Length > 0); if (picture?.StartsWith('/') == true) picture = "http://d.musicapp.migu.cn" + picture;
            var metadata = JsonSerializer.Serialize(new { songmid = id, copyrightId, source = "mg", lrcUrl = GetString(item, "lrcUrl"), mrcUrl = GetString(item, "mrcurl"), trcUrl = GetString(item, "trcUrl") });
            result.Add(new Track($"mg_{id}", GetString(item, "name"), singer, "mg", FormatSeconds(GetInt(item, "duration")), null, GetString(item, "album"), picture, metadata));
        }
        return result;
    }

    public async Task<IReadOnlyList<Track>> SearchBiliAsync(string text, int limit = 20, CancellationToken cancellationToken = default)
    {
        var url = $"https://api.bilibili.com/x/web-interface/wbi/search/type?keyword={Uri.EscapeDataString(text)}&search_type=video&page=1";
        using var request = CreateBiliRequest(HttpMethod.Get, url); using var response = await http.SendAsync(request, cancellationToken); response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!TryPath(document.RootElement, out var list, "data", "result") || list.ValueKind != JsonValueKind.Array) return Array.Empty<Track>();
        var result = new List<Track>();
        foreach (var item in list.EnumerateArray().Take(limit))
        {
            var bvid = GetString(item, "bvid"); if (bvid.Length == 0) continue; var title = StripHtml(GetString(item, "title")); var duration = ParseDuration(GetString(item, "duration")); var picture = GetString(item, "pic"); if (picture.StartsWith("//")) picture = "https:" + picture;
            var metadata = JsonSerializer.Serialize(new { songmid = $"{bvid}_0", bvid, aid = GetInt64(item, "aid"), cid = 0, page = 1, source = "bili" });
            result.Add(new Track($"bili_{bvid}_0", title, StripHtml(GetString(item, "author")), "bili", duration, null, "Bilibili", picture, metadata));
        }
        return result;
    }

    public async Task<string?> ResolveBiliUrlAsync(Track track, CancellationToken cancellationToken = default)
    {
        var bvid = ReadMeta(track, "bvid"); if (string.IsNullOrWhiteSpace(bvid)) return null;
        using var viewRequest = CreateBiliRequest(HttpMethod.Get, $"https://api.bilibili.com/x/web-interface/view?bvid={Uri.EscapeDataString(bvid)}"); using var viewResponse = await http.SendAsync(viewRequest, cancellationToken); viewResponse.EnsureSuccessStatusCode(); using var view = JsonDocument.Parse(await viewResponse.Content.ReadAsStreamAsync(cancellationToken));
        if (!TryPath(view.RootElement, out var pages, "data", "pages") || pages.ValueKind != JsonValueKind.Array || pages.GetArrayLength() == 0) return null; var cid = GetInt64(pages[0], "cid"); if (cid == 0) return null;
        var url = $"https://api.bilibili.com/x/player/playurl?bvid={Uri.EscapeDataString(bvid)}&cid={cid}&qn=80&fnval=16&fnver=0&fourk=1"; using var playRequest = CreateBiliRequest(HttpMethod.Get, url); using var playResponse = await http.SendAsync(playRequest, cancellationToken); playResponse.EnsureSuccessStatusCode(); using var play = JsonDocument.Parse(await playResponse.Content.ReadAsStreamAsync(cancellationToken));
        if (TryPath(play.RootElement, out var audio, "data", "dash", "audio") && audio.ValueKind == JsonValueKind.Array)
        {
            return audio.EnumerateArray().OrderByDescending(item => GetInt64(item, "bandwidth")).Select(item => GetString(item, "baseUrl") is { Length: > 0 } value ? value : GetString(item, "base_url")).FirstOrDefault(value => value.Length > 0);
        }
        return TryPath(play.RootElement, out var durl, "data", "durl") && durl.ValueKind == JsonValueKind.Array && durl.GetArrayLength() > 0 ? GetString(durl[0], "url") : null;
    }

    private static void AddKugou(JsonElement item, List<Track> result, HashSet<string> ids)
    {
        var hash = GetString(item, "FileHash"); var id = GetInt64(item, "Audioid").ToString(); if (hash.Length == 0 || id == "0" || !ids.Add(id + hash)) return;
        var singer = item.TryGetProperty("Singers", out var singers) && singers.ValueKind == JsonValueKind.Array ? string.Join("、", singers.EnumerateArray().Select(value => GetString(value, "name")).Where(value => value.Length > 0)) : GetString(item, "SingerName");
        var metadata = JsonSerializer.Serialize(new { songmid = id, hash, source = "kg", albumId = GetString(item, "AlbumID") });
        result.Add(new Track($"kg_{id}_{hash[..Math.Min(8, hash.Length)]}", GetString(item, "SongName"), singer, "kg", FormatSeconds(GetInt(item, "Duration")), null, GetString(item, "AlbumName"), null, metadata));
    }

    private static bool TryPath(JsonElement root, out JsonElement value, params string[] path)
    {
        value = root;
        foreach (var key in path)
        {
            if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(key, out var next)) return false;
            value = next;
        }
        return true;
    }
    private static string GetString(JsonElement item, string name) { if (!item.TryGetProperty(name, out var value)) return ""; return value.ValueKind switch { JsonValueKind.String => value.GetString() ?? "", JsonValueKind.Number => value.GetRawText(), _ => "" }; }
    private static int GetInt(JsonElement item, string name) => item.TryGetProperty(name, out var value) ? value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : int.TryParse(value.GetString(), out number) ? number : 0 : 0;
    private static long GetInt64(JsonElement item, string name) => item.TryGetProperty(name, out var value) ? value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var number) ? number : long.TryParse(value.GetString(), out number) ? number : 0 : 0;
    private static string FormatSeconds(int seconds) => seconds > 0 ? TimeSpan.FromSeconds(seconds).ToString(@"m\:ss") : "";
    private static string ParseDuration(string value) { var parts = value.Split(':'); return parts.Length >= 2 && parts.All(part => int.TryParse(part, out _)) ? value : ""; }
    private static string StripHtml(string value) => Regex.Replace(value, "<[^>]+>", string.Empty).Replace("&amp;", "&", StringComparison.Ordinal).Replace("&#039;", "'", StringComparison.Ordinal);
    private static HttpRequestMessage CreateBiliRequest(HttpMethod method, string url) { var request = new HttpRequestMessage(method, url); request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"); request.Headers.Referrer = new Uri("https://www.bilibili.com/"); request.Headers.TryAddWithoutValidation("Origin", "https://www.bilibili.com"); return request; }
    private static string? ReadMeta(Track track, string key) { if (string.IsNullOrWhiteSpace(track.RawMeta)) return null; try { using var document = JsonDocument.Parse(track.RawMeta); return document.RootElement.TryGetProperty(key, out var value) ? value.GetString() : null; } catch { return null; } }

    private static string Decode(JsonElement item, string name) => item.TryGetProperty(name, out var value) ? value.GetString()?.Replace("&amp;", "&", StringComparison.Ordinal) ?? "" : "";
    private static string[] ParseQualities(string? value) => string.IsNullOrWhiteSpace(value) ? Array.Empty<string>() : InfoRegex.Matches(value).Select(match => match.Groups[2].Value switch { "4000" => "flac24bit", "2000" => "flac", "320" => "320k", "128" => "128k", _ => "" }).Where(x => x.Length > 0).Distinct().ToArray();
}
