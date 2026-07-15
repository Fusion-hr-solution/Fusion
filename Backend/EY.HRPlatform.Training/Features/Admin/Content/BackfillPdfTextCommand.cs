using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Content;

/// <summary>
/// US-8.2.5 — one-time (idempotent) backfill: extract and store text for already-uploaded PDF content
/// blocks that have no stored text yet, so existing trainings' PDFs also feed the AI quiz generator.
/// Skips PDFs whose file is missing on disk or that yield no text (scanned/image PDFs).
/// </summary>
public record BackfillPdfTextCommand : ICommand<Result<BackfillPdfTextResult>>;

public class BackfillPdfTextResult
{
    /// <summary>PDF blocks examined (empty text + a local upload URL).</summary>
    public int Scanned { get; set; }
    /// <summary>Blocks that got text extracted and saved.</summary>
    public int Updated { get; set; }
    /// <summary>Blocks skipped — file missing, not a local upload, or no extractable text.</summary>
    public int Skipped { get; set; }
}

public class BackfillPdfTextCommandHandler : ICommandHandler<BackfillPdfTextCommand, Result<BackfillPdfTextResult>>
{
    private readonly TrainingDbContext _db;
    private readonly IPdfTextExtractor _pdf;

    public BackfillPdfTextCommandHandler(TrainingDbContext db, IPdfTextExtractor pdf)
    {
        _db = db;
        _pdf = pdf;
    }

    public async Task<Result<BackfillPdfTextResult>> Handle(BackfillPdfTextCommand request, CancellationToken cancellationToken)
    {
        var candidates = await _db.ContentBlocks
            .Where(b => b.Type == ContentType.Pdf
                        && (b.TextContent == null || b.TextContent == "")
                        && b.ContentUri != null
                        && b.ContentUri.StartsWith("/api/training/uploads/"))
            .ToListAsync(cancellationToken);

        var result = new BackfillPdfTextResult { Scanned = candidates.Count };
        foreach (var b in candidates)
        {
            var text = _pdf.TryExtract(b.ContentUri);
            if (string.IsNullOrWhiteSpace(text))
            {
                result.Skipped++;
                continue;
            }
            b.Update(b.Type, b.Title, text, b.ContentUri, b.VideoUrl, b.EstimatedDurationMinutes);
            result.Updated++;
        }

        if (result.Updated > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(result);
    }
}
