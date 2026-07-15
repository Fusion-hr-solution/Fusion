using System.Text;
using EY.HRPlatform.Training.Domain.Enums;
using UglyToad.PdfPig;

namespace EY.HRPlatform.Training.Features.Admin.Content;

/// <summary>
/// Extracts plain text from locally-uploaded PDF files so it can be stored in ContentBlock.TextContent
/// (US-8.2.5) and fed to the AI quiz generator (and any future search/RAG) without re-downloading the
/// file. Digital (text-based) PDFs only — scanned/image PDFs yield no text and would need OCR.
/// </summary>
public interface IPdfTextExtractor
{
    /// <summary>Extract text from the PDF referenced by an upload ContentUri; null if not a resolvable local PDF or on failure. Never throws.</summary>
    string? TryExtract(string? contentUri);

    /// <summary>
    /// For a Pdf block that has an uploaded file but no authored text, returns the extracted text;
    /// otherwise returns <paramref name="textContent"/> unchanged. Use when building/updating a ContentBlock.
    /// </summary>
    string? ResolveTextContent(ContentType type, string? textContent, string? contentUri);
}

public class PdfTextExtractor : IPdfTextExtractor
{
    // Matches the URL produced by UploadChapterFileCommandHandler ("/api/training/uploads/...").
    private const string UrlPrefix = "/api/training/uploads/";
    private const int MaxChars = 100_000;

    private readonly IWebHostEnvironment _env;
    private readonly ILogger<PdfTextExtractor> _logger;

    public PdfTextExtractor(IWebHostEnvironment env, ILogger<PdfTextExtractor> logger)
    {
        _env = env;
        _logger = logger;
    }

    public string? ResolveTextContent(ContentType type, string? textContent, string? contentUri)
    {
        if (type != ContentType.Pdf || !string.IsNullOrWhiteSpace(textContent) || string.IsNullOrWhiteSpace(contentUri))
            return textContent;
        return TryExtract(contentUri) ?? textContent;
    }

    public string? TryExtract(string? contentUri)
    {
        if (string.IsNullOrWhiteSpace(contentUri)) return null;
        if (!contentUri.StartsWith(UrlPrefix, StringComparison.OrdinalIgnoreCase)) return null; // external URL, not a local file
        if (!contentUri.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) return null;

        try
        {
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relative = contentUri[UrlPrefix.Length..].Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.GetFullPath(Path.Combine(webRoot, relative));

            // Path-traversal guard — the resolved file must stay under <wwwroot>/uploads.
            var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads"));
            if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase)) return null;
            if (!File.Exists(fullPath)) return null;

            var sb = new StringBuilder();
            using (var doc = PdfDocument.Open(fullPath))
            {
                foreach (var page in doc.GetPages())
                {
                    sb.AppendLine(page.Text);
                    if (sb.Length >= MaxChars) break;
                }
            }

            var text = sb.ToString().Trim();
            if (text.Length > MaxChars) text = text[..MaxChars];
            return text.Length > 0 ? text : null; // image-only/scanned PDFs produce no text
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PDF text extraction failed for {ContentUri}", contentUri);
            return null;
        }
    }
}
