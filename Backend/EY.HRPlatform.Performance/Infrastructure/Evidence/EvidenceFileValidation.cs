namespace EY.HRPlatform.Performance.Infrastructure.Evidence;

public static class EvidenceFileValidation
{
    public const long MaxBytes = 20 * 1024 * 1024;
    private static readonly Dictionary<string, string[]> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = ["application/pdf"], [".png"] = ["image/png"],
        [".jpg"] = ["image/jpeg"], [".jpeg"] = ["image/jpeg"],
        [".webp"] = ["image/webp"], [".gif"] = ["image/gif"],
        [".docx"] = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        [".xlsx"] = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        [".pptx"] = ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        [".txt"] = ["text/plain"], [".csv"] = ["text/csv", "application/csv", "text/plain"],
    };

    public static string Validate(string fileName, string? declaredType, ReadOnlySpan<byte> header)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var type = (declaredType ?? "").Split(';')[0].Trim().ToLowerInvariant();
        if (!Allowed.TryGetValue(extension, out var types) || !types.Contains(type))
            throw new ArgumentException("Choose a PDF, image, Office document, text or CSV file.");
        var valid = extension switch
        {
            ".pdf" => header.StartsWith("%PDF-"u8),
            ".png" => header.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            ".jpg" or ".jpeg" => header.StartsWith(new byte[] { 255, 216, 255 }),
            ".gif" => header.StartsWith("GIF87a"u8) || header.StartsWith("GIF89a"u8),
            ".webp" => header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8),
            _ => true,
        };
        if (!valid) throw new ArgumentException("The file contents do not match its type.");
        return type;
    }
}
