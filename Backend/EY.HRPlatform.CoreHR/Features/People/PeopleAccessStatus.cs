using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

public sealed record PeopleAccessStatusQuery(string EmployeeKey)
    : IQuery<Result<PeopleAccessStatusDto>>;

public sealed record PeopleAccessStatusDto(
    string State,
    string Label,
    string? Detail);

public sealed class PeopleAccessStatusQueryHandler(
    CoreHRDbContext dbContext,
    IWorkforceAccountStatusReader statusReader)
    : IQueryHandler<PeopleAccessStatusQuery, Result<PeopleAccessStatusDto>>
{
    public async Task<Result<PeopleAccessStatusDto>> Handle(
        PeopleAccessStatusQuery request,
        CancellationToken cancellationToken)
    {
        var key = request.EmployeeKey.Trim().ToUpperInvariant();
        var employee = await dbContext.Employees.AsNoTracking()
            .Where(item => item.StableEmployeeKey == key)
            .Select(item => new
            {
                item.Id,
                item.Email,
                item.FirstName,
                item.LastName
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (employee is null)
            return Result.Failure<PeopleAccessStatusDto>(new Error("Employee.NotFound", "Employee was not found."));
        if (string.IsNullOrWhiteSpace(employee.Email))
            return Result.Success(new PeopleAccessStatusDto(
                "NoFusionAccess",
                "No Fusion access",
                "A work email is required before access can be linked."));

        var statuses = await statusReader.GetStatusesAsync(
            [new WorkforceAccountSubjectDto(employee.Id, employee.Email, employee.FirstName, employee.LastName)],
            cancellationToken);
        var status = statuses.GetValueOrDefault(employee.Id);
        if (status?.UserId is not null)
            return Result.Success(new PeopleAccessStatusDto(
                "Linked",
                "Linked",
                status.IsActive == false ? "Account inactive" : null));

        return Result.Success(new PeopleAccessStatusDto(
            "NoFusionAccess",
            "No Fusion access",
            status?.Conflict?.Message));
    }
}
