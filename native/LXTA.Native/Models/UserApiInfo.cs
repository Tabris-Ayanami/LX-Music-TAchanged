using System.Text.Json;

namespace LXTA_Native.Models;

public sealed record UserApiInfo(string Id, string Name, string Description, string Version, string Author, string Homepage, bool AllowShowUpdateAlert);
public sealed record UserApiRequestResult(string Source, string Action, JsonElement Data);
