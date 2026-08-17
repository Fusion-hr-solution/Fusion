using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

public sealed record ManagerOptionsQuery(
    DateTime EffectiveDate,
    string? Q = null,
    Guid? ExcludeEmployeeId = null,
    int Limit = 30) : IQuery<Result<IReadOnlyList<ManagerOptionDto>>>;

public sealed record ManagerOptionDto(
    Guid EmployeeId,
    string EmployeeKey,
    string EmployeeNumber,
    string DisplayName,
    string JobTitle,
    string OrganizationName,
    string OrganizationPath,
    string Availability);

public sealed class ManagerOptionsQueryHandler(
    CoreHRDbContext dbContext,
    IOrganizationService organizationService)
    : IQueryHandler<ManagerOptionsQuery, Result<IReadOnlyList<ManagerOptionDto>>>
{
    public async Task<Result<IReadOnlyList<ManagerOptionDto>>> Handle(
        ManagerOptionsQuery request,
        CancellationToken cancellationToken)
    {
        var at = DateTime.SpecifyKind(request.EffectiveDate.Date, DateTimeKind.Utc);
        var q = request.Q?.Trim().ToLowerInvariant();
        var limit = Math.Clamp(request.Limit, 1, 50);
        var rows = await (
            from employee in dbContext.Employees.AsNoTracking()
            join employment in dbContext.Employments.AsNoTracking()
                on employee.Id equals employment.EmployeeId
            join assignment in dbContext.WorkAssignments.AsNoTracking()
                on new { EmployeeId = employee.Id, EmploymentId = employment.Id }
                equals new { assignment.EmployeeId, assignment.EmploymentId }
            where employment.EffectiveFrom <= at
                && (employment.EffectiveTo == null || at < employment.EffectiveTo)
                && assignment.IsPrimary
                && assignment.EffectiveFrom <= at
                && (assignment.EffectiveTo == null || at < assignment.EffectiveTo)
                && (!request.ExcludeEmployeeId.HasValue || employee.Id != request.ExcludeEmployeeId.Value)
                && (q == null
                    || employee.FirstName.ToLower().Contains(q)
                    || employee.LastName.ToLower().Contains(q)
                    || employee.EmployeeNumber.ToLower().Contains(q))
            orderby employee.LastName, employee.FirstName, employee.Id
            select new
            {
                employee.Id,
                employee.StableEmployeeKey,
                employee.EmployeeNumber,
                DisplayName = (employee.PreferredName ?? employee.FirstName) + " " + employee.LastName,
                assignment.JobTitle,
                assignment.OrgUnitId,
                employment.EffectiveFrom
            })
            .Take(limit)
            .ToListAsync(cancellationToken);

        var hierarchy = await organizationService.GetHierarchyAsync(
            DateOnly.FromDateTime(at),
            cancellationToken);
        var organizationById = Flatten(hierarchy.Roots)
            .ToDictionary(node => node.Unit.Id, node => node.Unit);
        var today = DateTime.UtcNow.Date;
        IReadOnlyList<ManagerOptionDto> result = rows.Select(row =>
        {
            organizationById.TryGetValue(row.OrgUnitId, out var organization);
            return new ManagerOptionDto(
                row.Id,
                row.StableEmployeeKey,
                row.EmployeeNumber,
                row.DisplayName,
                row.JobTitle,
                organization?.Name ?? "Organization unavailable",
                organization?.Path ?? "Organization unavailable",
                row.EffectiveFrom > today ? "Scheduled" : "Available");
        }).ToList();
        return Result.Success(result);
    }

    private static IEnumerable<OrganizationHierarchyNodeDto> Flatten(
        IEnumerable<OrganizationHierarchyNodeDto> nodes)
        => nodes.SelectMany(node => new[] { node }.Concat(Flatten(node.Children)));
}
