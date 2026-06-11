namespace EY.HRPlatform.Training.Features.Certifications;

/// <summary>
/// Privacy masking for the public verification page: each whitespace-separated name part keeps its
/// first three letters (or the whole part if shorter) and replaces every remaining letter with '*'.
/// e.g. "Youssef Harrabi" → "You**** Har****".
/// </summary>
public static class CertificateNameMasking
{
    private const int VisiblePrefix = 3;

    public static string Mask(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return string.Empty;

        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return string.Join(' ', parts.Select(MaskPart));
    }

    private static string MaskPart(string part)
    {
        if (part.Length <= VisiblePrefix)
            return part;

        return part[..VisiblePrefix] + new string('*', part.Length - VisiblePrefix);
    }
}
