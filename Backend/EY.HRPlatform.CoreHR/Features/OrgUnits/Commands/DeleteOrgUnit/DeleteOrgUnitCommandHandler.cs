using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.DeleteOrgUnit;

public sealed class DeleteOrgUnitCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<DeleteOrgUnitCommand, Result>
{
    public async Task<Result> Handle(
        DeleteOrgUnitCommand request,
        CancellationToken cancellationToken)
    {
        var orgUnit = await dbContext.OrgUnits
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (orgUnit is null)
        {
            throw new EntityNotFoundException("OrgUnit", request.Id);
        }

        // Check version for optimistic concurrency
        if (orgUnit.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("OrgUnit", request.Id);
        }

        // Check for deletion blockers
        var blockReason = await GetDeletionBlockReason(request.Id, cancellationToken);
        if (blockReason is not null)
        {
            return Result.Failure(new Error("Conflict", blockReason));
        }

        // Soft delete
        orgUnit.Deactivate();

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("OrgUnit", request.Id);
        }

        return Result.Success();
    }

    /// <summary>
    /// Check for conditions that block deletion.
    /// Returns null if deletion is allowed, otherwise returns the block reason.
    /// </summary>
    private async Task<string?> GetDeletionBlockReason(Guid orgUnitId, CancellationToken cancellationToken)
    {
        // Check 1: Active children
        var hasActiveChildren = await dbContext.OrgUnits
            .AnyAsync(o => o.ParentId == orgUnitId && o.IsActive, cancellationToken);

        if (hasActiveChildren)
        {
            return "Cannot delete org unit with active child units. Reassign or delete children first.";
        }

        // Check 2: Assigned active employees
        var now = DateTime.UtcNow;
        var hasAssignedEmployees = await dbContext.WorkAssignments
            .AsNoTracking()
            .Join(
                dbContext.Employments.AsNoTracking(),
                assignment => assignment.EmploymentId,
                employment => employment.Id,
                (assignment, employment) => new { assignment.OrgUnitId, Employment = employment })
            .AnyAsync(
                x => x.OrgUnitId == orgUnitId
                    && x.Employment.Status == EmploymentStatus.Active
                    && x.Employment.EffectiveFrom <= now
                    && (x.Employment.EffectiveTo == null || now < x.Employment.EffectiveTo),
                cancellationToken);

        if (hasAssignedEmployees)
        {
            return "Cannot delete org unit with assigned employees. Reassign employees first.";
        }

        return null; // No blockers
    }
}
