using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Content;

namespace EY.HRPlatform.Training.Tests.TestHelpers;

/// <summary>Stub — no file system in tests: returns no extracted text and passes authored text through unchanged.</summary>
public sealed class FakePdfTextExtractor : IPdfTextExtractor
{
    public string? TryExtract(string? contentUri) => null;

    public string? ResolveTextContent(ContentType type, string? textContent, string? contentUri) => textContent;
}
