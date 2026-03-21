using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;

public sealed class GetEmployeeByIdQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetEmployeeByIdQuery, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByIdQuery request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .Include(e => e.Manager)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        return Result.Success(MapToDto(employee));
    }

    private static EmployeeDto MapToDto(Employee employee) => new(
        employee.Id,
        employee.TenantId,
        employee.FirstName,
        employee.LastName,
        employee.Email,
        employee.Department,
        employee.JobTitle,
        employee.HireDate,
        employee.Status,
        employee.ManagerId,
        employee.Manager is not null
            ? new ManagerDto(employee.Manager.Id, employee.Manager.FirstName, employee.Manager.LastName, employee.Manager.Email)
            : null,
        employee.CreatedAt,
        employee.UpdatedAt);
}
