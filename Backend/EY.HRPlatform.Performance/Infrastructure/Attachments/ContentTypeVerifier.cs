namespace EY.HRPlatform.Performance.Infrastructure.Attachments;

/// <summary>
/// Verifies that an upload's bytes match the content type the client declared.
/// </summary>
/// <remarks>
/// A client-declared content type is an assertion, not evidence: without checking the bytes, an
/// executable renamed to <c>.pdf</c> passes the allow-list and is later served back under a type
/// that a browser may act on. Verifying the leading bytes means the stored type is what the file
/// actually is, and it is that verified type — never the declared one — that downloads are served
/// with.
/// </remarks>
public static class ContentTypeVerifier
{
    /// <summary>Longest signature considered, so callers know how many bytes to buffer.</summary>
    public const int InspectionLength = 12;

    private static readonly (string ContentType, byte[][] Signatures)[] Signatures =
    [
        ("application/pdf", [[0x25, 0x50, 0x44, 0x46]]),                         // %PDF
        ("image/png", [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]),
        ("image/jpeg", [[0xFF, 0xD8, 0xFF]]),
        ("image/gif", [[0x47, 0x49, 0x46, 0x38]]),                               // GIF8
        ("application/msword", [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]]),
        ("application/vnd.ms-excel", [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]]),

        // The OpenXML formats are ZIP containers; the distinction between them is inside the
        // archive, so both verify to the same envelope signature.
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]]),
        ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]])
    ];

    /// <summary>
    /// Content types with no reliable signature. Text formats are structurally indistinguishable
    /// from arbitrary bytes, so they are accepted on declaration — and the <c>nosniff</c> header
    /// plus an attachment disposition is what keeps them inert on download.
    /// </summary>
    private static readonly HashSet<string> UnverifiableTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/plain",
        "text/csv"
    };

    /// <summary>
    /// True when <paramref name="content"/> is consistent with <paramref name="declaredContentType"/>.
    /// </summary>
    public static bool Matches(string declaredContentType, ReadOnlySpan<byte> content)
    {
        if (UnverifiableTypes.Contains(declaredContentType))
        {
            return true;
        }

        var known = Signatures.FirstOrDefault(entry =>
            string.Equals(entry.ContentType, declaredContentType, StringComparison.OrdinalIgnoreCase));

        if (known.Signatures is null)
        {
            // A type the allow-list permits but this verifier does not know: allow it rather than
            // reject on ignorance, so extending the allow-list does not silently break uploads.
            return true;
        }

        // An empty or truncated file cannot match a signature it is shorter than.
        foreach (var signature in known.Signatures)
        {
            if (StartsWith(content, signature))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>Whether a signature check is meaningful for this type at all.</summary>
    public static bool IsVerifiable(string declaredContentType)
        => !UnverifiableTypes.Contains(declaredContentType)
           && Signatures.Any(entry =>
               string.Equals(entry.ContentType, declaredContentType, StringComparison.OrdinalIgnoreCase));

    private static bool StartsWith(ReadOnlySpan<byte> content, byte[] signature)
        => content.Length >= signature.Length && content[..signature.Length].SequenceEqual(signature);
}
