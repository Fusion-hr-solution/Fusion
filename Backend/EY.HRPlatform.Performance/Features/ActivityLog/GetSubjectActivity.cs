using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ActivityLog;

public sealed record ActivityLogEntryDto(
    Guid Id,
    Guid? ActorUserId,
    string ActorName,
    string Action,
    string SubjectType,
    Guid SubjectId,
    DateTime OccurredAt,
    string? Metadata,
    string? CorrelationId);

/// <summary>
/// Reads a subject's activity history, most-recent-first, scoped to the current tenant by the
/// global query filter. Resource authorization is delegated to the consuming feature: the caller
/// passes its own authorization decision, and the log layer fails closed when it is not granted.
/// </summary>
public interface IActivityLogReader
{
    Task<Result<PagedResponse<ActivityLogEntryDto>>> GetSubjectHistoryAsync(
        string subjectType,
        Guid subjectId,
        bool authorized,
        CancellationToken cancellationToken,
        int? page = null,
        int? pageSize = null);
}

public sealed class ActivityLogReader(PerformanceDbContext db) : IActivityLogReader
{
    public async Task<Result<PagedResponse<ActivityLogEntryDto>>> GetSubjectHistoryAsync(
        string subjectType,
        Guid subjectId,
        bool authorized,
        CancellationToken cancellationToken,
        int? page = null,
        int? pageSize = null)
    {
        if (!authorized)
        {
            return Result.Failure<PagedResponse<ActivityLogEntryDto>>(
                Error.Forbidden("ActivityLog.Forbidden", "You are not authorized to view this activity history."));
        }

        var requestedPage = HistoryPage.From(page, pageSize);

        var query = db.ActivityLogEntries
            .AsNoTracking()
            .Where(a => a.SubjectType == subjectType && a.SubjectId == subjectId);

        var totalCount = await query.CountAsync(cancellationToken);

        var entries = await query
            // Id is the stable tiebreak: entries sharing a timestamp must not reorder between pages.
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.Id)
            .Skip(requestedPage.Skip)
            .Take(requestedPage.PageSize)
            .Select(a => new ActivityLogEntryDto(
                a.Id,
                a.ActorUserId,
                a.ActorName,
                a.Action,
                a.SubjectType,
                a.SubjectId,
                a.OccurredAt,
                a.Metadata,
                a.CorrelationId))
            .ToListAsync(cancellationToken);

        return Result.Success(requestedPage.ToResponse(entries, totalCount));
    }
}
