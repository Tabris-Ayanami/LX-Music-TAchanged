using LXTA_Native.Services;

var service = new OnlineSearchService();
var checks = new (string Name, Func<Task<IReadOnlyList<LXTA_Native.Models.Track>>> Search)[]
{
    ("kw", () => service.SearchKuwoAsync("周杰伦", 2)),
    ("kg", () => service.SearchKugouAsync("周杰伦", 2)),
    ("tx", () => service.SearchQqAsync("周杰伦", 2)),
    ("wy", () => service.SearchNeteaseAsync("周杰伦", 2)),
    ("mg", () => service.SearchMiguAsync("周杰伦", 2)),
    ("bili", () => service.SearchBiliAsync("周杰伦", 2)),
};

var failed = false;
foreach (var check in checks)
{
    try
    {
        var tracks = await check.Search();
        Console.WriteLine($"{check.Name}: {tracks.Count}");
        if (tracks.Count == 0) failed = true;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"{check.Name}: ERROR {ex.Message}");
        failed = true;
    }
}
return failed ? 1 : 0;
