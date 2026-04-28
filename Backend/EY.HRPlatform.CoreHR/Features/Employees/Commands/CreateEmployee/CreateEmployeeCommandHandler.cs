using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;

public sealed class CreateEmployeeCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeeHierarchyService hierarchyService) : ICommandHandler<CreateEmployeeCommand, Result<EmployeeDto>>
{
    private readonly IEmployeeHierarchyService employeeHierarchyService = hierarchyService;

    public async Task<Result<EmployeeDto>> Handle(CreateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // Check for duplicate email within tenant
        var emailExists = await dbContext.Employees
            .AnyAsync(e => e.Email == normalizedEmail, cancellationToken);

        if (emailExists)
        {
            throw new DuplicateEntityException("Employee", "email", normalizedEmail);
        }

        OrgUnit? orgUnit = null;
        if (request.OrgUnitId.HasValue && request.OrgUnitId.Value != Guid.Empty)
        {
            orgUnit = await dbContext.OrgUnits
                .FirstOrDefaultAsync(o => o.Id == request.OrgUnitId.Value, cancellationToken);

            if (orgUnit is null)
            {
                throw new EntityNotFoundException("OrgUnit", request.OrgUnitId.Value);
            }

            if (!orgUnit.IsActive)
            {
                throw new ArgumentException("Cannot assign inactive org unit.");
            }
        }

        // Create employee using domain factory
        var employee = Employee.Create(
            tenantId,
            request.FirstName,
            request.LastName,
            request.Email,
            request.HireDate,
            jobTitle: request.JobTitle);

        // Assign manager if specified
        if (request.ManagerId.HasValue)
        {
            await employeeHierarchyService.EnsureManagerAssignmentIsValidAsync(
                employee.Id,
                request.ManagerId,
                cancellationToken);
            employee.AssignManager(request.ManagerId.Value);
        }

        if (request.OrgUnitId.HasValue)
        {
            employee.AssignOrgUnit(request.OrgUnitId.Value);
        }

        dbContext.Employees.Add(employee);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            throw new DuplicateEntityException("Employee", "email", normalizedEmail);
        }

        // Load manager for response if assigned
        Employee? manager = null;
        if (employee.ManagerId.HasValue)
        {
            manager = await dbContext.Employees
                .FirstOrDefaultAsync(e => e.Id == employee.ManagerId.Value, cancellationToken);
        }

        return Result.Success(MapToDto(employee, manager, orgUnit));
    }

    private static EmployeeDto MapToDto(Employee employee, Employee? manager, OrgUnit? orgUnit) => new(
        employee.Id,
        employee.TenantId,
        employee.FirstName,
        employee.LastName,
        employee.Email,
        employee.OrgUnitId,
        orgUnit?.Name,
        employee.JobTitle,
        employee.HireDate,
        employee.Status,
        employee.ManagerId,
        manager is not null ? new ManagerDto(manager.Id, manager.FirstName, manager.LastName, manager.Email) : null,
        employee.CreatedAt,
        employee.UpdatedAt,
        employee.Version);

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        // PostgreSQL unique violation error code: 23505
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }
}
