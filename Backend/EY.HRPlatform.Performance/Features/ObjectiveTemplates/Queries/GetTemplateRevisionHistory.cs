using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;

public sealed record GetTemplateRevisionHistoryQuery(Guid TemplateId)
    : IQuery<Result<IReadOnlyList<TemplateRevisionHistoryEntryDto>>>;

/// <summary>
/// Simple read-only revision list (P1.1 §15.2): current and prior revisions with concise
/// activation metadata. Not a generic audit browser — no filtering, diffing, or raw events.
/// </summary>
public sealed class GetTemplateRevisionHistoryQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetTemplateRevisionHistoryQuery, Result<IReadOnlyList<TemplateRevisionHistoryEntryDto>>>
{
    public async Task<Result<IReadOnlyList<TemplateRevisionHistoryEntryDto>>> Handle(
        GetTemplateRevisionHistoryQuery query,
        CancellationToken cancellationToken)
    {
        var templateExists = await db.ObjectiveTemplateContainers
            .AnyAsync(t => t.Id == query.TemplateId, cancellationToken);

        if (!templateExists)
            return Result.Failure<IReadOnlyList<TemplateRevisionHistoryEntryDto>>(
                Error.NotFound("ObjectiveTemplate", query.TemplateId));

        var revisions = await db.ObjectiveTemplateRevisions
            .AsNoTracking()
            .Where(r => r.TemplateId == query.TemplateId)
            .OrderByDescending(r => r.VersionNumber)
            .ToListAsync(cancellationToken);

        IReadOnlyList<TemplateRevisionHistoryEntryDto> result = revisions
            .Select(r => new TemplateRevisionHistoryEntryDto(
                r.Id, r.VersionNumber, r.Status.ToString(), r.Title,
                r.ActivatedAt, r.ActivatedByName, r.SupersededAt, r.ChangeSummary))
            .ToList();

        return Result.Success(result);
    }
}
