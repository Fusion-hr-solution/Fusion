using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public interface IReportingRelationshipService
{
    Task<EmployeeReportingRelationship> AddAsync(
        Guid subjectEmployeeId,
        Guid managerEmployeeId,
        Guid subjectPositionAssignmentId,
        Guid managerPositionAssignmentId,
        ReportingRelationshipType type,
        DateTime effectiveFrom,
        DateTime? effectiveTo,
        CancellationToken cancellationToken);
}

/// <summary>
/// Enforces the Core invariants for relationships that may drive downstream workflow.
/// Only PrimaryManager edges participate in chain validation.
/// </summary>
public sealed class ReportingRelationshipService(CoreHRDbContext dbContext) : IReportingRelationshipService
{
    public async Task<EmployeeReportingRelationship> AddAsync(
        Guid subjectEmployeeId,
        Guid managerEmployeeId,
        Guid subjectPositionAssignmentId,
        Guid managerPositionAssignmentId,
        ReportingRelationshipType type,
        DateTime effectiveFrom,
        DateTime? effectiveTo,
        CancellationToken cancellationToken)
    {
        var assignments = await dbContext.EmployeePositionAssignments
            .Where(x => x.Id == subjectPositionAssignmentId || x.Id == managerPositionAssignmentId)
            .ToListAsync(cancellationToken);
        var subjectAssignment = assignments.SingleOrDefault(x => x.Id == subjectPositionAssignmentId)
            ?? throw new InvalidOperationException("The subject position assignment is not in the current tenant.");
        var managerAssignment = assignments.SingleOrDefault(x => x.Id == managerPositionAssignmentId)
            ?? throw new InvalidOperationException("The manager position assignment is not in the current tenant.");
        if (subjectAssignment.EmployeeId != subjectEmployeeId || managerAssignment.EmployeeId != managerEmployeeId)
            throw new InvalidOperationException("Reporting relationships must use assignments owned by their stated employees.");
        if (type == ReportingRelationshipType.PrimaryManager && !subjectAssignment.IsPrimary)
            throw new InvalidOperationException("A primary manager relationship requires the subject's primary position assignment.");

        var relationship = EmployeeReportingRelationship.Create(
            subjectAssignment.TenantId,
            subjectEmployeeId,
            managerEmployeeId,
            subjectPositionAssignmentId,
            managerPositionAssignmentId,
            type,
            effectiveFrom,
            effectiveTo);

        if (type == ReportingRelationshipType.PrimaryManager)
        {
            var existingPrimaryRelationships = await dbContext.EmployeeReportingRelationships
                .Where(x => x.SubjectPositionAssignmentId == subjectPositionAssignmentId && x.Type == ReportingRelationshipType.PrimaryManager)
                .ToListAsync(cancellationToken);
            if (existingPrimaryRelationships.Any(existing => Overlaps(existing, relationship)))
                throw new InvalidOperationException("A primary employment assignment can have only one effective primary manager.");

            await EnsureNoPrimaryManagementCycleAsync(subjectEmployeeId, managerEmployeeId, relationship.EffectiveFrom, cancellationToken);
        }

        dbContext.EmployeeReportingRelationships.Add(relationship);
        await dbContext.SaveChangesAsync(cancellationToken);
        return relationship;
    }

    private async Task EnsureNoPrimaryManagementCycleAsync(
        Guid subjectEmployeeId,
        Guid managerEmployeeId,
        DateTime effectiveAt,
        CancellationToken cancellationToken)
    {
        var visited = new HashSet<Guid> { subjectEmployeeId };
        var currentManagerId = managerEmployeeId;

        while (true)
        {
            if (!visited.Add(currentManagerId))
                throw new InvalidOperationException("The primary management relationship would create a cycle.");

            var next = await dbContext.EmployeeReportingRelationships
                .Where(x => x.SubjectEmployeeId == currentManagerId
                    && x.Type == ReportingRelationshipType.PrimaryManager
                    && x.EffectiveFrom <= effectiveAt
                    && (!x.EffectiveTo.HasValue || x.EffectiveTo > effectiveAt))
                .OrderByDescending(x => x.EffectiveFrom)
                .Select(x => (Guid?)x.ManagerEmployeeId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!next.HasValue)
                return;

            currentManagerId = next.Value;
        }
    }

    private static bool Overlaps(EmployeeReportingRelationship existing, EmployeeReportingRelationship candidate)
    {
        var existingEnd = existing.EffectiveTo ?? DateTime.MaxValue;
        var candidateEnd = candidate.EffectiveTo ?? DateTime.MaxValue;
        return existing.EffectiveFrom < candidateEnd && candidate.EffectiveFrom < existingEnd;
    }
}
