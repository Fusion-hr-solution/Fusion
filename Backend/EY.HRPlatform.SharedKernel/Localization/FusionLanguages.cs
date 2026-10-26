namespace EY.HRPlatform.SharedKernel.Localization;

/// <summary>
/// The languages Fusion speaks. One list, so Identity, its tests and later the
/// services that write emails agree on what a person can choose.
/// </summary>
public static class FusionLanguages
{
    public const string English = "en";
    public const string French = "fr";
    public const string Arabic = "ar";

    /// <summary>Used when neither the person nor their company names a supported language.</summary>
    public const string Default = English;

    public const int MaxLength = 8;

    public static IReadOnlyList<string> Supported { get; } = [English, French, Arabic];

    public static bool IsSupported(string? language)
        => language is not null && Supported.Contains(language, StringComparer.Ordinal);

    /// <summary>
    /// The language part of a locale such as <c>fr-FR</c>, when Fusion supports it;
    /// otherwise null, so the caller falls through to the next source.
    /// </summary>
    public static string? FromLocale(string? locale)
    {
        if (string.IsNullOrWhiteSpace(locale)) return null;

        var language = locale.Trim().Split('-', '_')[0].ToLowerInvariant();
        return IsSupported(language) ? language : null;
    }

    /// <summary>The person's own choice, else their company's language, else English.</summary>
    public static string Resolve(string? preferred, string? tenantLocale)
        => IsSupported(preferred) ? preferred! : FromLocale(tenantLocale) ?? Default;
}
