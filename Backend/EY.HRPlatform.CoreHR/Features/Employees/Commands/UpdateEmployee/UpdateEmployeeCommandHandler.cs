using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;

public sealed class UpdateEmployeeCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<UpdateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(UpdateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            throw new EntityNotFoundException("Employee", request.EmployeeId);
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // Check for duplicate email within tenant (excluding current employee)
        if (normalizedEmail != employee.Email)
        {
            var emailExists = await dbContext.Employees
                .AnyAsync(e => e.Email == normalizedEmail && e.Id != request.EmployeeId, cancellationToken);

            if (emailExists)
            {
                throw new DuplicateEntityException("Employee", "email", normalizedEmail);
            }
        }

        // Validate manager exists and belongs to same tenant (if specified)
        if (request.ManagerId.HasValue && request.ManagerId.Value != Guid.Empty)
        {
            var managerExists = await dbContext.Employees
                .AnyAsync(e => e.Id == request.ManagerId.Value, cancellationToken);

            if (!managerExists)
            {
                throw new EntityNotFoundException("Manager", request.ManagerId.Value);
            }
        }

        // Update employee details
        employee.UpdateDetails(
            request.FirstName,
            request.LastName,
            request.Email,
            request.Department,
            request.JobTitle);

        // Update manager assignment
        employee.AssignManager(request.ManagerId);

        await dbContext.SaveChangesAsync(cancellationToken);

        // Load manager for response if assigned
        Employee? manager = null;
        if (employee.ManagerId.HasValue)
        {
            manager = await dbContext.Employees
                .FirstOrDefaultAsync(e => e.Id == employee.ManagerId.Value, cancellationToken);
        }

        return Result.Success(MapToDto(employee, manager));
    }

    private static EmployeeDto MapToDto(Employee employee, Employee? manager) => new(
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
        manager is not null ? new ManagerDto(manager.Id, manager.FirstName, manager.LastName, manager.Email) : null,
        employee.CreatedAt,
        employee.UpdatedAt);
}
