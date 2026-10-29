using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using EY.HRPlatform.SharedKernel.Localization;

namespace EY.HRPlatform.SharedKernel.Notifications;

/// <summary>
/// A module's notification wording in every Fusion language, read from embedded <c>{prefix}-{language}.json</c> files
/// (flat <c>"Kind.part": "text"</c> maps). A notification stores a key and values, never a sentence, so the same
/// record reads in whichever language the reader uses now. Names stay as people wrote them.
/// </summary>
public sealed partial class NotificationCatalog
{
    /// <summary>The value that picks a plural form: <c>key#one</c>, <c>key#other</c> (Arabic also zero, two, few, many).</summary>
    public const string CountValue = "count";

    private readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> _entries;

    public NotificationCatalog(IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> entries)
    {
        if (!entries.ContainsKey(FusionLanguages.Default))
            throw new ArgumentException("A catalogue needs its English entries.", nameof(entries));
        _entries = entries;
    }

    /// <summary>Every language's entries, for parity tests.</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Entries => _entries;

    public static NotificationCatalog FromAssembly(Assembly assembly, string resourcePrefix)
    {
        var entries = new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.Ordinal);
        foreach (var language in FusionLanguages.Supported)
        {
            using var stream = assembly.GetManifestResourceStream($"{resourcePrefix}-{language}.json");
            if (stream is null) continue;
            entries[language] = JsonSerializer.Deserialize<Dictionary<string, string>>(stream)
                ?? throw new InvalidOperationException($"The {language} notification catalogue is empty.");
        }
        return new NotificationCatalog(entries);
    }

    /// <summary>
    /// The entry for <paramref name="key"/> in <paramref name="language"/> with its values filled in, falling back to
    /// English when the language lacks it; null when no language has it.
    /// </summary>
    public string? Text(string? language, string key, IReadOnlyDictionary<string, string>? values = null)
    {
        var lang = FusionLanguages.IsSupported(language) ? language! : FusionLanguages.Default;
        var template = Find(lang, key, values);
        if (template is null && lang != FusionLanguages.Default)
        {
            lang = FusionLanguages.Default;
            template = Find(lang, key, values);
        }
        if (template is null) return null;
        var culture = Culture(lang);
        return Placeholder().Replace(template, match =>
        {
            var name = match.Groups["name"].Value;
            if (values is null || !values.TryGetValue(name, out var value)) return string.Empty;
            return match.Groups["format"].Value switch
            {
                "date" when DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                    => date.ToString("ddd d MMM", culture),
                _ => value,
            };
        });
    }

    private string? Find(string language, string key, IReadOnlyDictionary<string, string>? values)
    {
        if (!_entries.TryGetValue(language, out var entries)) return null;
        if (values is not null && values.TryGetValue(CountValue, out var raw)
            && int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var count)
            && (entries.TryGetValue($"{key}#{PluralCategory(language, count)}", out var plural) || entries.TryGetValue($"{key}#other", out plural)))
            return plural;
        return entries.TryGetValue(key, out var text) ? text : null;
    }

    /// <summary>CLDR cardinal categories for the languages Fusion speaks.</summary>
    public static string PluralCategory(string language, int count) => language switch
    {
        FusionLanguages.French => count is 0 or 1 ? "one" : "other",
        FusionLanguages.Arabic => count switch
        {
            0 => "zero",
            1 => "one",
            2 => "two",
            _ when count % 100 is >= 3 and <= 10 => "few",
            _ when count % 100 is >= 11 and <= 99 => "many",
            _ => "other",
        },
        _ => count == 1 ? "one" : "other",
    };

    /// <summary>Dates in the reader's language, on the Gregorian calendar (the default Arabic culture may not be).</summary>
    public static CultureInfo Culture(string language)
    {
        if (language == FusionLanguages.French) return CultureInfo.GetCultureInfo("fr-FR");
        if (language != FusionLanguages.Arabic) return CultureInfo.InvariantCulture;
        var arabic = (CultureInfo)CultureInfo.GetCultureInfo("ar").Clone();
        if (arabic.DateTimeFormat.Calendar is not GregorianCalendar)
            arabic.DateTimeFormat.Calendar = arabic.OptionalCalendars.OfType<GregorianCalendar>().FirstOrDefault() ?? new GregorianCalendar();
        return arabic;
    }

    /// <summary>The placeholder names an entry uses, for tests that keep languages and email entries in line.</summary>
    public static IReadOnlySet<string> PlaceholdersOf(string template)
        => Placeholder().Matches(template).Select(match => match.Groups["name"].Value).ToHashSet(StringComparer.Ordinal);

    [GeneratedRegex(@"\{(?<name>[a-zA-Z]+)(?::(?<format>[a-z]+))?\}")]
    private static partial Regex Placeholder();
}
