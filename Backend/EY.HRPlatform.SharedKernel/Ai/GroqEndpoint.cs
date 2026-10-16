namespace EY.HRPlatform.SharedKernel.Ai;

/// <summary>Where a module may send AI requests: Groq over HTTPS, or a loopback URL for development fakes.</summary>
public static class GroqEndpoint
{
    public const string Provider = "Groq";
    public const string DefaultModel = "openai/gpt-oss-120b";
    public const string DefaultUrl = "https://api.groq.com/openai/v1";

    public static bool IsAllowed(string? endpoint)
        => Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) && IsAllowed(uri);

    public static bool IsAllowed(Uri uri)
        => (uri.IsLoopback
                || (uri.Scheme == Uri.UriSchemeHttps && string.Equals(uri.Host, "api.groq.com", StringComparison.OrdinalIgnoreCase)))
            && string.IsNullOrEmpty(uri.UserInfo)
            && string.IsNullOrEmpty(uri.Query)
            && string.IsNullOrEmpty(uri.Fragment);

    /// <summary>The base address for a typed <see cref="HttpClient"/>: relative "chat/completions" resolves under it.</summary>
    public static Uri BaseAddress(string endpoint)
        => new(endpoint.EndsWith('/') ? endpoint : endpoint + "/");
}
