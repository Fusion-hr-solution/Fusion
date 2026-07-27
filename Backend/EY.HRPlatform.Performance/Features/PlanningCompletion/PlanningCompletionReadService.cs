using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion;

public sealed class PlanningCompletionReadService(
    PerformanceDbContext dbContext,
    ICoreWorkforceClient workforceClient)
{
    private const int MaxPageSize = 200;

    public async Task<Result<PlanningCompletionWorkspaceDto>> GetWorkspaceAsync(
        string slug,
        string? status,
        string? blocker,
        bool? overdue,
        bool? reminderNeeded,
        Guid? approverEmployeeId,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.Slug == (slug ?? string.Empty).Trim().ToLowerInvariant(),
                cancellationToken);

        if (cycle is null)
            return Result.Failure<PlanningCompletionWorkspaceDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        // A closed campaign is read-only, not unreadable: every read still answers with the
        // state as it stood at closure.
        if (!cycle.IsOpenOrClosed())
        {
            return Result.Success(new PlanningCompletionWorkspaceDto(
                "not-launched",
                cycle.Id,
                cycle.Slug,
                cycle.Name,
                cycle.ReferenceYear,
                cycle.PlanningOpeningDate,
                cycle.EmployeeSubmissionDeadline,
                cycle.ManagerApprovalDeadline,
                cycle.ExpectedPlanningLockDate,
                cycle.LaunchedAt,
                cycle.PlanningLockedAt,
                cycle.PlanningLockedByName,
                cycle.Version,
                EmptySummary(),
                [],
                new PlanningCompletionParticipantPageDto([], 0, 1, Math.Clamp(pageSize, 1, MaxPageSize))));
        }

        var allParticipants = await BuildParticipantsAsync(cycle, cancellationToken);
        var filtered = Filter(allParticipants, status, blocker, overdue, reminderNeeded, approverEmployeeId, search)
            .OrderBy(item => StatusSort(item.Status))
            .ThenBy(item => item.EmployeeName)
            .ToList();

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var items = filtered
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();

        var summary = BuildSummary(allParticipants);
        var state = cycle.IsPlanningLocked
            ? "locked"
            : summary.IsReadyToLock
                ? "ready-to-lock"
                : summary.BlockedCount > 0
                    ? "blocked"
                    : "actionable";

        return Result.Success(new PlanningCompletionWorkspaceDto(
            state,
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            cycle.ReferenceYear,
            cycle.PlanningOpeningDate,
            cycle.EmployeeSubmissionDeadline,
            cycle.ManagerApprovalDeadline,
            cycle.ExpectedPlanningLockDate,
            cycle.LaunchedAt,
            cycle.PlanningLockedAt,
            cycle.PlanningLockedByName,
            cycle.Version,
            summary,
            BuildRemainingGroups(allParticipants),
            new PlanningCompletionParticipantPageDto(items, filtered.Count, safePage, safePageSize)));
    }

    public async Task<Result<PlanningCompletionParticipantDetailDto>> GetParticipantDetailAsync(
        Guid cycleId,
        Guid participantEmployeeId,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == cycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.NotFound("PerformanceCycle", cycleId));

        var participant = (await BuildParticipantsAsync(cycle, cancellationToken))
            .FirstOrDefault(item => item.ParticipantEmployeeId == participantEmployeeId);
        if (participant is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.NotFound("PerformanceCycleParticipant", participantEmployeeId));

        var reminders = await dbContext.PerformancePlanningReminders
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId && item.ParticipantEmployeeId == participantEmployeeId)
            .OrderByDescending(item => item.RecordedAt)
            .Select(item => new PlanningCompletionReminderDto(
                item.Id,
                item.TargetEmployeeId,
                item.TargetName,
                item.TargetType,
                item.Reason,
                item.RecordedByName,
                item.RecordedAt,
                item.NotificationTriggered))
            .ToListAsync(cancellationToken);

        var reassignments = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId && item.ParticipantEmployeeId == participantEmployeeId)
            .OrderByDescending(item => item.ReassignedAt)
            .Select(item => new PlanningCompletionReassignmentDto(
                item.Id,
                item.PreviousApproverEmployeeId,
                item.PreviousApproverName,
                item.NewApproverEmployeeId,
                item.NewApproverName,
                item.Reason,
                item.ReassignedByName,
                item.ReassignedAt))
            .ToListAsync(cancellationToken);

        return Result.Success(new PlanningCompletionParticipantDetailDto(participant, reminders, reassignments));
    }

    public async Task<Result<IReadOnlyList<PlanningCompletionRemainingGroupDto>>> ValidateLockReadinessAsync(
        Guid cycleId,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == cycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<IReadOnlyList<PlanningCompletionRemainingGroupDto>>(
                Error.NotFound("PerformanceCycle", cycleId));

        var participants = await BuildParticipantsAsync(cycle, cancellationToken);
        return Result.Success(BuildRemainingGroups(participants));
    }

    private async Task<IReadOnlyList<PlanningCompletionParticipantDto>> BuildParticipantsAsync(
        PerformanceCycle cycle,
        CancellationToken cancellationToken)
    {
        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(item => item.CycleId == cycle.Id)
            .OrderBy(item => item.FullName)
            .ToListAsync(cancellationToken);

        if (participants.Count == 0)
            return [];

        var employeeIds = participants.Select(item => item.EmployeeId).ToHashSet();
        var plans = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .Where(item => item.CycleId == cycle.Id && employeeIds.Contains(item.EmployeeId))
            .ToListAsync(cancellationToken);
        var planByEmployee = plans.ToDictionary(item => item.EmployeeId);

        var exclusions = await dbContext.PerformanceCycleParticipantExclusions
            .AsNoTracking()
            .Where(item => item.CycleId == cycle.Id && employeeIds.Contains(item.ParticipantEmployeeId))
            .ToListAsync(cancellationToken);
        var exclusionByEmployee = exclusions.ToDictionary(item => item.ParticipantEmployeeId);

        var reassignments = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycle.Id && employeeIds.Contains(item.ParticipantEmployeeId))
            .OrderBy(item => item.ReassignedAt)
            .ToListAsync(cancellationToken);
        var latestReassignmentByEmployee = reassignments
            .GroupBy(item => item.ParticipantEmployeeId)
            .ToDictionary(group => group.Key, group => group.Last());

        var reminders = await dbContext.PerformancePlanningReminders
            .AsNoTracking()
            .Where(item => item.CycleId == cycle.Id)
            .OrderBy(item => item.RecordedAt)
            .ToListAsync(cancellationToken);
        var lastReminderByParticipant = reminders
            .Where(item => item.ParticipantEmployeeId.HasValue)
            .GroupBy(item => item.ParticipantEmployeeId!.Value)
            .ToDictionary(group => group.Key, group => group.Last());

        var effectiveReviewerIds = participants
            .Select(item => latestReassignmentByEmployee.TryGetValue(item.EmployeeId, out var reassignment)
                ? reassignment.NewApproverEmployeeId
                : item.ApproverEmployeeId)
            .Where(item => item != Guid.Empty)
            .Distinct()
            .ToList();

        var reviewerActivity = await ResolveReviewerActivityAsync(effectiveReviewerIds, cancellationToken);
        var now = DateTime.UtcNow;

        return participants
            .Select(participant =>
            {
                planByEmployee.TryGetValue(participant.EmployeeId, out var plan);
                exclusionByEmployee.TryGetValue(participant.EmployeeId, out var exclusion);
                latestReassignmentByEmployee.TryGetValue(participant.EmployeeId, out var reassignment);
                lastReminderByParticipant.TryGetValue(participant.EmployeeId, out var reminder);

                var effectiveReviewerId = reassignment?.NewApproverEmployeeId ?? participant.ApproverEmployeeId;
                var effectiveReviewerName = reassignment?.NewApproverName ?? participant.ApproverName;
                var effectiveReviewerActive = reviewerActivity.GetValueOrDefault(effectiveReviewerId);
                var blockers = BuildBlockers(participant, plan, effectiveReviewerId, effectiveReviewerActive).ToList();
                var overdueIndicators = BuildOverdueIndicators(cycle, plan, now).ToList();
                var status = ResolveStatus(plan, exclusion, blockers);
                var lastActivityAt = ResolveLastActivity(plan, exclusion, reminder);

                return new PlanningCompletionParticipantDto(
                    participant.EmployeeId,
                    participant.FullName,
                    participant.EmployeeKey,
                    participant.Email,
                    participant.JobTitle,
                    participant.OrgUnitName,
                    status,
                    StatusLabel(status),
                    plan?.Status == PlanStatus.Approved && exclusion is null && blockers.Count == 0,
                    exclusion is not null,
                    blockers.Count > 0 && exclusion is null,
                    overdueIndicators.Count > 0,
                    exclusion is null && status != "approved" && (overdueIndicators.Count > 0 || blockers.Count > 0 || status is "not-started" or "draft" or "submitted" or "changes-requested"),
                    lastActivityAt,
                    plan is null ? null : ToPlanDto(plan),
                    new PlanningCompletionReviewerDto(participant.ApproverEmployeeId, participant.ApproverName, null),
                    new PlanningCompletionReviewerDto(effectiveReviewerId, effectiveReviewerName, effectiveReviewerActive),
                    reassignment is not null,
                    exclusion is null ? null : new PlanningCompletionExclusionDto(exclusion.Reason, exclusion.ExcludedByName, exclusion.ExcludedAt),
                    blockers,
                    overdueIndicators,
                    reminder is null
                        ? null
                        : new PlanningCompletionReminderDto(
                            reminder.Id,
                            reminder.TargetEmployeeId,
                            reminder.TargetName,
                            reminder.TargetType,
                            reminder.Reason,
                            reminder.RecordedByName,
                            reminder.RecordedAt,
                            reminder.NotificationTriggered));
            })
            .ToList();
    }

    private async Task<Dictionary<Guid, bool?>> ResolveReviewerActivityAsync(
        IReadOnlyCollection<Guid> reviewerEmployeeIds,
        CancellationToken cancellationToken)
    {
        if (reviewerEmployeeIds.Count == 0)
            return [];

        try
        {
            var resolved = await workforceClient.ResolveEmployeesAsync(reviewerEmployeeIds, cancellationToken);
            var byId = resolved.ToDictionary(item => item.EmployeeId, item => (bool?)item.IsActive);
            foreach (var id in reviewerEmployeeIds)
                byId.TryAdd(id, false);
            return byId;
        }
        catch
        {
            return reviewerEmployeeIds.ToDictionary(item => item, _ => (bool?)null);
        }
    }

    private static IEnumerable<PlanningCompletionBlockerDto> BuildBlockers(
        PerformanceCycleParticipant participant,
        EmployeeObjectivePlan? plan,
        Guid effectiveReviewerId,
        bool? effectiveReviewerActive)
    {
        if (effectiveReviewerId == Guid.Empty)
            yield return new PlanningCompletionBlockerDto("missing-reviewer", "Missing reviewer");

        if (effectiveReviewerId == participant.EmployeeId)
            yield return new PlanningCompletionBlockerDto("self-approval", "Self-approval data issue");

        if (effectiveReviewerActive == false)
            yield return new PlanningCompletionBlockerDto("reviewer-unavailable", "Reviewer unavailable");

        if (plan is { Status: PlanStatus.Approved, ApprovedAt: null })
            yield return new PlanningCompletionBlockerDto("plan-state", "Approved plan is missing approval time");

        if (plan is { Status: PlanStatus.Submitted, SubmittedAt: null })
            yield return new PlanningCompletionBlockerDto("plan-state", "Submitted plan is missing submission time");
    }

    private static IEnumerable<PlanningCompletionOverdueDto> BuildOverdueIndicators(
        PerformanceCycle cycle,
        EmployeeObjectivePlan? plan,
        DateTime now)
    {
        if (cycle.EmployeeSubmissionDeadline.HasValue
            && now > cycle.EmployeeSubmissionDeadline.Value
            && plan?.Status is null or PlanStatus.Draft or PlanStatus.ChangesRequested)
        {
            yield return new PlanningCompletionOverdueDto(
                "employee-submission",
                "Employee submission overdue",
                cycle.EmployeeSubmissionDeadline.Value);
        }

        if (cycle.ManagerApprovalDeadline.HasValue
            && now > cycle.ManagerApprovalDeadline.Value
            && plan?.Status == PlanStatus.Submitted)
        {
            yield return new PlanningCompletionOverdueDto(
                "manager-review",
                "Manager review overdue",
                cycle.ManagerApprovalDeadline.Value);
        }
    }

    private static string ResolveStatus(
        EmployeeObjectivePlan? plan,
        PerformanceCycleParticipantExclusion? exclusion,
        IReadOnlyCollection<PlanningCompletionBlockerDto> blockers)
    {
        if (exclusion is not null)
            return "excluded";
        if (blockers.Count > 0)
            return "blocked";

        return plan?.Status switch
        {
            null => "not-started",
            PlanStatus.Draft => "draft",
            PlanStatus.Submitted => "submitted",
            PlanStatus.ChangesRequested => "changes-requested",
            PlanStatus.Approved => "approved",
            _ => "blocked"
        };
    }

    private static DateTime? ResolveLastActivity(
        EmployeeObjectivePlan? plan,
        PerformanceCycleParticipantExclusion? exclusion,
        PerformancePlanningReminder? reminder)
    {
        var values = new[]
        {
            plan?.UpdatedAt ?? plan?.CreatedAt,
            plan?.SubmittedAt,
            plan?.ApprovedAt,
            plan?.ReviewEvents.OrderByDescending(item => item.OccurredAt).FirstOrDefault()?.OccurredAt,
            exclusion?.ExcludedAt,
            reminder?.RecordedAt
        };

        return values.Where(item => item.HasValue).Max();
    }

    private static PlanningCompletionPlanDto ToPlanDto(EmployeeObjectivePlan plan)
        => new(
            plan.Id,
            PlanStatusCode(plan.Status),
            PlanStatusLabel(plan.Status),
            plan.Objectives.Count,
            plan.Objectives.Sum(item => item.Weight ?? 0),
            plan.SubmittedAt,
            plan.ApprovedAt,
            plan.Version);

    private static IEnumerable<PlanningCompletionParticipantDto> Filter(
        IEnumerable<PlanningCompletionParticipantDto> participants,
        string? status,
        string? blocker,
        bool? overdue,
        bool? reminderNeeded,
        Guid? approverEmployeeId,
        string? search)
    {
        var query = participants;

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(item => item.Status == normalized);
        }

        if (!string.IsNullOrWhiteSpace(blocker) && !string.Equals(blocker, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = blocker.Trim().ToLowerInvariant();
            query = query.Where(item => item.Blockers.Any(b => b.Code == normalized));
        }

        if (overdue.HasValue)
            query = query.Where(item => item.IsOverdue == overdue.Value);

        if (reminderNeeded.HasValue)
            query = query.Where(item => item.ReminderNeeded == reminderNeeded.Value);

        if (approverEmployeeId.HasValue)
            query = query.Where(item => item.EffectiveReviewer.EmployeeId == approverEmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item =>
                item.EmployeeName.Contains(term, StringComparison.OrdinalIgnoreCase)
                || (item.Email?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false)
                || (item.EmployeeKey?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false));
        }

        return query;
    }

    private static PlanningCompletionSummaryDto BuildSummary(IReadOnlyCollection<PlanningCompletionParticipantDto> participants)
    {
        var approved = participants.Count(item => item.Status == "approved");
        var excluded = participants.Count(item => item.Status == "excluded");
        var remaining = participants.Count - approved - excluded;

        return new PlanningCompletionSummaryDto(
            participants.Count,
            approved,
            excluded,
            remaining,
            participants.Count(item => item.Status == "not-started"),
            participants.Count(item => item.Status == "draft"),
            participants.Count(item => item.Status == "submitted"),
            participants.Count(item => item.Status == "changes-requested"),
            participants.Count(item => item.Status == "blocked"),
            participants.Count(item => item.IsOverdue),
            participants.Count(item => item.ReminderNeeded),
            participants.Count > 0 && remaining == 0);
    }

    private static IReadOnlyList<PlanningCompletionRemainingGroupDto> BuildRemainingGroups(
        IReadOnlyCollection<PlanningCompletionParticipantDto> participants)
    {
        if (participants.Count == 0)
            return [new PlanningCompletionRemainingGroupDto("no-participants", "No frozen participants", 1)];

        return participants
            .Where(item => item.Status is not ("approved" or "excluded"))
            .GroupBy(item => item.Status)
            .Select(group => new PlanningCompletionRemainingGroupDto(
                group.Key,
                StatusLabel(group.Key),
                group.Count()))
            .OrderBy(item => StatusSort(item.Code))
            .ToList();
    }

    private static PlanningCompletionSummaryDto EmptySummary()
        => new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);

    private static string PlanStatusCode(PlanStatus status)
        => status switch
        {
            PlanStatus.Draft => "draft",
            PlanStatus.Submitted => "submitted",
            PlanStatus.ChangesRequested => "changes-requested",
            PlanStatus.Approved => "approved",
            _ => "unknown"
        };

    private static string PlanStatusLabel(PlanStatus status)
        => StatusLabel(PlanStatusCode(status));

    private static string StatusLabel(string status)
        => status switch
        {
            "not-started" => "Not started",
            "draft" => "Draft",
            "submitted" => "Submitted",
            "changes-requested" => "Changes requested",
            "approved" => "Approved",
            "excluded" => "Excluded",
            "blocked" => "Blocked",
            _ => "Unknown"
        };

    private static int StatusSort(string status)
        => status switch
        {
            "blocked" => 0,
            "submitted" => 1,
            "changes-requested" => 2,
            "draft" => 3,
            "not-started" => 4,
            "approved" => 5,
            "excluded" => 6,
            _ => 7
        };
}
