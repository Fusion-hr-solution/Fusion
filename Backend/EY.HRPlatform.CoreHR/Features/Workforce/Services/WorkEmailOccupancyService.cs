using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public interface IWorkEmailOccupancyService
{
    Task<Result> SynchronizeAsync(Guid employeeId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Keeps the database-backed email claim aligned with the staged Employee/Employment graph.
/// Callers still commit once, so Employee, Employment and claim move or roll back together.
/// </summary>
public sealed class WorkEmailOccupancyService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : IWorkEmailOccupancyService
{
    public async Task<Result> SynchronizeAsync(
        Guid employeeId,
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantContext.TenantId;
        var employee = dbContext.Employees.Local.FirstOrDefault(x => x.Id == employeeId)
            ?? await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken);
        if (employee is null)
            return Result.Failure(Error.NotFound("Employee", employeeId));

        var trackedEmploymentEntries = dbContext.ChangeTracker.Entries<Employment>()
            .Where(entry => entry.Entity.EmployeeId == employeeId)
            .ToList();
        var overriddenIds = trackedEmploymentEntries.Select(entry => entry.Entity.Id).ToHashSet();
        var hasTrackedRelevantEmployment = trackedEmploymentEntries.Any(entry =>
            entry.State != EntityState.Deleted
            && entry.Entity.Status == EmploymentStatus.Active
            && entry.Entity.EffectiveTo is null);
        var hasPersistedRelevantEmployment = await dbContext.Employments
            .AsNoTracking()
            .AnyAsync(employment =>
                employment.EmployeeId == employeeId
                && employment.Status == EmploymentStatus.Active
                && employment.EffectiveTo == null
                && !overriddenIds.Contains(employment.Id), cancellationToken);

        var occupancy = dbContext.WorkEmailOccupancies.Local
            .FirstOrDefault(x => x.EmployeeId == employeeId)
            ?? await dbContext.WorkEmailOccupancies
                .FirstOrDefaultAsync(x => x.EmployeeId == employeeId, cancellationToken);
        var needsOccupancy = (hasTrackedRelevantEmployment || hasPersistedRelevantEmployment)
            && employee.Email is not null;

        if (!needsOccupancy)
        {
            if (occupancy is not null)
                dbContext.WorkEmailOccupancies.Remove(occupancy);
            return Result.Success();
        }

        var normalizedEmail = employee.Email!;
        var trackedConflict = dbContext.WorkEmailOccupancies.Local.Any(x =>
            x.EmployeeId != employeeId && x.NormalizedEmail == normalizedEmail);
        var persistedConflict = trackedConflict || await dbContext.WorkEmailOccupancies
            .AsNoTracking()
            .AnyAsync(x => x.EmployeeId != employeeId && x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (persistedConflict)
        {
            return Result.Failure(Error.Conflict(
                "Employee.EmailOccupied",
                "This work email is already used by a scheduled or active employee."));
        }

        if (occupancy is null)
            dbContext.WorkEmailOccupancies.Add(WorkEmailOccupancy.Create(tenantId, employeeId, normalizedEmail));
        else if (!string.Equals(occupancy.NormalizedEmail, normalizedEmail, StringComparison.Ordinal))
            occupancy.MoveTo(normalizedEmail);

        return Result.Success();
    }
}
