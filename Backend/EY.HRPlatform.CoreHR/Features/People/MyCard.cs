using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

/// <summary>
/// The signed-in person's own card for the Fusion sidebar and home: their name, and their job title and
/// org unit from the primary work assignment as of today. Title and unit are null without a current assignment.
/// </summary>
/// <param name="PhotoUrl">API-relative photo address with a cache version, or null without a photo.</param>
public sealed record MyCardDto(string DisplayName, string? JobTitle, string? OrgUnitName, string? PhotoUrl = null);

/// <summary>Self-only: the controller passes the caller's own employee id from the token, never a request value.</summary>
public sealed record MyCardQuery(Guid EmployeeId, DateTime AsOf) : IQuery<Result<MyCardDto>>;

public sealed class MyCardQueryHandler(CoreHRDbContext dbContext, IWorkforceCanonicalResolver resolver)
    : IQueryHandler<MyCardQuery, Result<MyCardDto>>
{
    public async Task<Result<MyCardDto>> Handle(MyCardQuery request, CancellationToken cancellationToken)
    {
        // Runs inside the tenant query filter: an employee id from another tenant is simply not found.
        var employee = await dbContext.Employees.AsNoTracking()
            .Where(item => item.Id == request.EmployeeId)
            .Select(item => new { item.FirstName, item.LastName, item.PreferredName, item.StableEmployeeKey, item.PhotoKey })
            .FirstOrDefaultAsync(cancellationToken);
        if (employee is null)
            return Result.Failure<MyCardDto>(new Error("Employee.NotFound", "Employee was not found."));

        var photoUrl = EmployeePhotos.UrlFor(employee.StableEmployeeKey, employee.PhotoKey);
        var displayName = string.IsNullOrWhiteSpace(employee.PreferredName)
            ? $"{employee.FirstName} {employee.LastName}"
            : $"{employee.PreferredName} {employee.LastName}";

        var assignment = await resolver.GetPrimaryWorkAssignmentAsync(request.EmployeeId, request.AsOf, cancellationToken);
        if (assignment is null)
            return Result.Success(new MyCardDto(displayName, null, null, photoUrl));

        var unitName = await dbContext.OrgUnits.AsNoTracking()
            .Where(unit => unit.Id == assignment.OrgUnitId)
            .Select(unit => unit.Name)
            .FirstOrDefaultAsync(cancellationToken);
        var jobTitle = string.IsNullOrWhiteSpace(assignment.JobTitle) ? null : assignment.JobTitle;
        return Result.Success(new MyCardDto(displayName, jobTitle, unitName, photoUrl));
    }
}
