using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

public sealed record PeopleProfileQuery(string EmployeeKey) : IQuery<Result<PeopleProfileDto>>;

public sealed record PeopleProfileIdentityDto(
    string EmployeeKey,
    string EmployeeNumber,
    string DisplayName,
    string FirstName,
    string LastName,
    string? PreferredName,
    string? WorkEmail,
    string? Phone);

public sealed record PeopleProfileEmploymentDto(
    PeopleEmploymentState State,
    DateTime? Start,
    DateTime? End,
    string? EmploymentType);

public sealed record PeopleProfileReportDto(
    string EmployeeKey,
    string EmployeeNumber,
    string DisplayName);

public sealed record PeopleProfileDto(
    PeopleProfileIdentityDto Identity,
    PeopleProfileEmploymentDto Employment,
    PeopleWorkDto? Work,
    PeopleManagerDto? PrimaryManager,
    int DirectReportCount,
    IReadOnlyList<PeopleProfileReportDto> DirectReports,
    string Completeness,
    uint Version);

public sealed class PeopleProfileQueryHandler(
    CoreHRDbContext dbContext,
    IOrganizationService organizationService)
    : IQueryHandler<PeopleProfileQuery, Result<PeopleProfileDto>>
{
    public async Task<Result<PeopleProfileDto>> Handle(
        PeopleProfileQuery request,
        CancellationToken cancellationToken)
    {
        var key = request.EmployeeKey.Trim().ToUpperInvariant();
        var employee = await dbContext.Employees.AsNoTracking()
            .FirstOrDefaultAsync(item => item.StableEmployeeKey == key, cancellationToken);
        if (employee is null)
            return Result.Failure<PeopleProfileDto>(new Error("Employee.NotFound", "Employee was not found."));

        var today = DateTime.UtcNow.Date;
        var employment = await ResolveEmploymentAsync(employee.Id, today, cancellationToken);
        var state = ResolveState(employment, today);
        var displayAt = ResolveDisplayAt(employment, state, today);
        var assignment = employment is null
            ? null
            : await dbContext.WorkAssignments.AsNoTracking()
                .Where(item => item.EmployeeId == employee.Id
                    && item.EmploymentId == employment.Id
                    && item.IsPrimary
                    && item.EffectiveFrom <= displayAt
                    && (item.EffectiveTo == null || displayAt < item.EffectiveTo))
                .OrderByDescending(item => item.EffectiveFrom)
                .FirstOrDefaultAsync(cancellationToken);

        PeopleWorkDto? work = null;
        if (assignment is not null)
        {
            var organization = await organizationService.GetUnitAsync(
                assignment.OrgUnitId,
                DateOnly.FromDateTime(displayAt),
                cancellationToken);
            work = new PeopleWorkDto(
                assignment.JobTitle,
                organization.Name,
                organization.Path,
                assignment.WorkLocation,
                assignment.EffectiveFrom,
                state == PeopleEmploymentState.Former);
        }

        PeopleManagerDto? manager = null;
        if (assignment is not null)
        {
            manager = await (
                from relationship in dbContext.ManagerRelationships.AsNoTracking()
                join managerEmployee in dbContext.Employees.AsNoTracking()
                    on relationship.ManagerEmployeeId equals managerEmployee.Id
                where relationship.SubjectEmployeeId == employee.Id
                    && relationship.SubjectWorkAssignmentId == assignment.Id
                    && relationship.Type == ReportingRelationshipType.PrimaryManager
                    && relationship.EffectiveFrom <= displayAt
                    && (relationship.EffectiveTo == null || displayAt < relationship.EffectiveTo)
                orderby relationship.EffectiveFrom descending
                select new PeopleManagerDto(
                    managerEmployee.StableEmployeeKey,
                    (managerEmployee.PreferredName ?? managerEmployee.FirstName) + " " + managerEmployee.LastName,
                    managerEmployee.EmployeeNumber))
                .FirstOrDefaultAsync(cancellationToken);
        }

        var directReportQuery =
            from relationship in dbContext.ManagerRelationships.AsNoTracking()
            join report in dbContext.Employees.AsNoTracking()
                on relationship.SubjectEmployeeId equals report.Id
            where relationship.ManagerEmployeeId == employee.Id
                && relationship.Type == ReportingRelationshipType.PrimaryManager
                && relationship.EffectiveFrom <= displayAt
                && (relationship.EffectiveTo == null || displayAt < relationship.EffectiveTo)
            select report;
        var directReportCount = await directReportQuery.CountAsync(cancellationToken);
        var directReports = await directReportQuery
            .OrderBy(report => report.LastName)
            .ThenBy(report => report.FirstName)
            .ThenBy(report => report.Id)
            .Take(5)
            .Select(report => new PeopleProfileReportDto(
                report.StableEmployeeKey,
                report.EmployeeNumber,
                (report.PreferredName ?? report.FirstName) + " " + report.LastName))
            .ToListAsync(cancellationToken);

        var result = new PeopleProfileDto(
            new PeopleProfileIdentityDto(
                employee.StableEmployeeKey,
                employee.EmployeeNumber,
                employee.DisplayName,
                employee.FirstName,
                employee.LastName,
                employee.PreferredName,
                employee.Email,
                employee.Phone),
            new PeopleProfileEmploymentDto(
                state,
                employment?.EffectiveFrom,
                employment?.EffectiveTo,
                employment?.EmploymentType),
            work,
            manager,
            directReportCount,
            directReports,
            employment is null ? "EmploymentUnavailable"
                : work is null ? "WorkDetailsUnavailable"
                : "Complete",
            employee.Version);
        return Result.Success(result);
    }

    private async Task<Employment?> ResolveEmploymentAsync(
        Guid employeeId,
        DateTime today,
        CancellationToken cancellationToken)
    {
        var active = await dbContext.Employments.AsNoTracking()
            .Where(item => item.EmployeeId == employeeId
                && item.EffectiveFrom <= today
                && (item.EffectiveTo == null || today < item.EffectiveTo))
            .OrderByDescending(item => item.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);
        if (active is not null)
            return active;

        var scheduled = await dbContext.Employments.AsNoTracking()
            .Where(item => item.EmployeeId == employeeId && item.EffectiveFrom > today)
            .OrderBy(item => item.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);
        if (scheduled is not null)
            return scheduled;

        return await dbContext.Employments.AsNoTracking()
            .Where(item => item.EmployeeId == employeeId
                && (item.Status == EmploymentStatus.Ended || item.EffectiveTo <= today))
            .OrderByDescending(item => item.EffectiveTo ?? item.EffectiveFrom)
            .ThenByDescending(item => item.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static PeopleEmploymentState ResolveState(Employment? employment, DateTime today)
        => employment switch
        {
            null => PeopleEmploymentState.Incomplete,
            _ when employment.EffectiveFrom > today => PeopleEmploymentState.Scheduled,
            _ when employment.EffectiveTo is null || today < employment.EffectiveTo => PeopleEmploymentState.Active,
            _ => PeopleEmploymentState.Former
        };

    private static DateTime ResolveDisplayAt(
        Employment? employment,
        PeopleEmploymentState state,
        DateTime today)
        => state switch
        {
            PeopleEmploymentState.Scheduled => employment!.EffectiveFrom,
            PeopleEmploymentState.Former => employment!.EffectiveTo!.Value.AddTicks(-1),
            _ => today
        };
}
