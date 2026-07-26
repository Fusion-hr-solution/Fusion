using EY.HRPlatform.Performance.Infrastructure.Persistence;
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
    Task<Result<IReadOnlyList<ActivityLogEntryDto>>> GetSubjectHistoryAsync(
        string subjectType,
        Guid subjectId,
        bool authorized,
        CancellationToken cancellationToken);
}

public sealed class ActivityLogReader(PerformanceDbContext db) : IActivityLogReader
{
    public async Task<Result<IReadOnlyList<ActivityLogEntryDto>>> GetSubjectHistoryAsync(
        string subjectType,
        Guid subjectId,
        bool authorized,
        CancellationToken cancellationToken)
    {
        if (!authorized)
        {
            return Result.Failure<IReadOnlyList<ActivityLogEntryDto>>(
                Error.Forbidden("ActivityLog.Forbidden", "You are not authorized to view this activity history."));
        }

        var entries = await db.ActivityLogEntries
            .AsNoTracking()
            .Where(a => a.SubjectType == subjectType && a.SubjectId == subjectId)
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.CreatedAt)
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

        return Result.Success<IReadOnlyList<ActivityLogEntryDto>>(entries);
    }
}
