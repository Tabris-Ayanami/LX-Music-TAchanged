namespace LXTA.Storage.Legacy;

public sealed class LegacyLibraryException(string message, Exception? innerException = null)
    : Exception(message, innerException);
