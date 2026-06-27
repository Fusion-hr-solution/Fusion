using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfile;

public sealed class GetEmployeeProfileQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeDetailsReadModelService employeeDetailsReadModelService) : IQueryHandler<GetEmployeeProfileQuery, Result<EmployeeProfileDto>>
{
    public async Task<Result<EmployeeProfileDto>> Handle(GetEmployeeProfileQuery request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeProfileDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        return Result.Success(await employeeDetailsReadModelService.BuildProfileAsync(
            employee,
            request.Audience,
            null,
            cancellationToken));
    }
}
