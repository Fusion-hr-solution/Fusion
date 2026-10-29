using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

/// <summary>
/// One row of the Job information table: the person's job as it stood from <see cref="EffectiveDate"/> until the
/// next row. A row starts wherever the primary work assignment or the primary manager changed.
/// </summary>
public sealed record PeopleJobHistoryRowDto(
    DateTime EffectiveDate,
    string JobTitle,
    Guid OrgUnitId,
    string UnitName,
    string? Location,
    PeopleManagerDto? Manager,
    bool IsCurrent);

/// <summary>Newest first, up to today; scheduled changes are under Coming up, not here.</summary>
public sealed record PeopleJobHistoryDto(IReadOnlyList<PeopleJobHistoryRowDto> Rows);

public sealed record PeopleJobHistoryQuery(string EmployeeKey, PeopleViewer Viewer) : IQuery<Result<PeopleJobHistoryDto>>;

public sealed class PeopleJobHistoryQueryHandler(CoreHRDbContext dbContext)
    : IQueryHandler<PeopleJobHistoryQuery, Result<PeopleJobHistoryDto>>
{
    public async Task<Result<PeopleJobHistoryDto>> Handle(PeopleJobHistoryQuery request, CancellationToken cancellationToken)
    {
        var key = request.EmployeeKey.Trim().ToUpperInvariant();
        var employeeId = await dbContext.Employees.AsNoTracking()
            .Where(item => item.StableEmployeeKey == key)
            .Select(item => (Guid?)item.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (employeeId is not { } id)
            return Result.Failure<PeopleJobHistoryDto>(new Error("Employee.NotFound", "Employee was not found."));
        if (!(await PeopleAccess.DecideAsync(dbContext, request.Viewer, id, cancellationToken)).CanReadJobHistory)
            return Result.Failure<PeopleJobHistoryDto>(PeopleAccess.Forbidden("You can't see this person's job history."));

        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var assignments = await dbContext.WorkAssignments.AsNoTracking()
            .Where(item => item.EmployeeId == id && item.IsPrimary && item.EffectiveFrom <= today)
            .ToListAsync(cancellationToken);
        var lines = await dbContext.ManagerRelationships.AsNoTracking()
            .Where(item => item.SubjectEmployeeId == id
                && item.Type == ReportingRelationshipType.PrimaryManager
                && item.EffectiveFrom <= today)
            .ToListAsync(cancellationToken);

        var unitIds = assignments.Select(item => item.OrgUnitId).Distinct().ToList();
        var units = await dbContext.OrgUnits.AsNoTracking()
            .Where(item => unitIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var managerIds = lines.Select(item => item.ManagerEmployeeId).Distinct().ToList();
        var managers = await dbContext.Employees.AsNoTracking()
            .Where(item => managerIds.Contains(item.Id))
            .Select(item => new
            {
                item.Id,
                Dto = new PeopleManagerDto(
                    item.StableEmployeeKey,
                    (item.PreferredName ?? item.FirstName) + " " + item.LastName,
                    item.EmployeeNumber,
                    EmployeePhotos.UrlFor(item.StableEmployeeKey, item.PhotoKey)),
            })
            .ToDictionaryAsync(item => item.Id, item => item.Dto, cancellationToken);

        // Every date something changed, oldest first; each yields the state on that date.
        var dates = assignments.Select(item => item.EffectiveFrom)
            .Concat(lines.Select(item => item.EffectiveFrom))
            .Concat(lines.Where(item => item.EffectiveTo <= today).Select(item => item.EffectiveTo!.Value))
            .Select(date => date.Date)
            .Distinct()
            .Order();

        var rows = new List<PeopleJobHistoryRowDto>();
        foreach (var date in dates)
        {
            var assignment = assignments
                .Where(item => item.EffectiveFrom.Date <= date && (item.EffectiveTo == null || date < item.EffectiveTo.Value.Date))
                .MaxBy(item => item.EffectiveFrom);
            if (assignment is null)
                continue;
            var line = lines
                .Where(item => item.EffectiveFrom.Date <= date && (item.EffectiveTo == null || date < item.EffectiveTo.Value.Date))
                .MaxBy(item => item.EffectiveFrom);
            var row = new PeopleJobHistoryRowDto(
                DateTime.SpecifyKind(date, DateTimeKind.Utc),
                assignment.JobTitle,
                assignment.OrgUnitId,
                units.GetValueOrDefault(assignment.OrgUnitId, "Unknown unit"),
                assignment.WorkLocation,
                line is null ? null : managers.GetValueOrDefault(line.ManagerEmployeeId),
                IsCurrent: false);
            if (rows.Count > 0 && SameJob(rows[^1], row))
                continue;
            rows.Add(row);
        }

        // The last row is the job today only if an assignment still holds today.
        if (rows.Count > 0 && assignments.Any(item => item.EffectiveTo == null || today < item.EffectiveTo))
            rows[^1] = rows[^1] with { IsCurrent = true };
        rows.Reverse();
        return Result.Success(new PeopleJobHistoryDto(rows));
    }

    private static bool SameJob(PeopleJobHistoryRowDto a, PeopleJobHistoryRowDto b)
        => a.JobTitle == b.JobTitle && a.OrgUnitId == b.OrgUnitId && a.Location == b.Location
            && a.Manager?.EmployeeKey == b.Manager?.EmployeeKey;
}
