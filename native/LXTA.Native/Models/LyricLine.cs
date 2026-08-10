namespace LXTA_Native.Models;

public sealed record LyricLine(TimeSpan Time, string Text, string? Translation = null);
