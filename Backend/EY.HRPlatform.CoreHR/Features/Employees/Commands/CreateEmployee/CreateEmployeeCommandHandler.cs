using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;

public sealed class CreateEmployeeCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeeHierarchyService hierarchyService,
    ITenantSettingsReadService tenantSettingsReadService) : ICommandHandler<CreateEmployeeCommand, Result<EmployeeDto>>
{
    private readonly IEmployeeHierarchyService employeeHierarchyService = hierarchyService;
    private static readonly HashSet<string> OperationallyRequiredFields =
        ["firstName", "lastName", "email", "hireDate"];

    public async Task<Result<EmployeeDto>> Handle(CreateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;
        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        ValidateConfiguredRequiredField(request.FirstName, "firstName", "First name", settings, true);
        ValidateConfiguredRequiredField(request.LastName, "lastName", "Last name", settings, true);
        ValidateConfiguredRequiredField(request.Email, "email", "Email", settings, true);
        ValidateConfiguredRequiredField(request.Phone, "phone", "Phone", settings, false);
        ValidateConfiguredRequiredField(request.JobTitle, "jobTitle", "Job title", settings, false);
        ValidateConfiguredRequiredField(request.WorkLocation, "workLocation", "Work location", settings, false);
        ValidateConfiguredRequiredField(request.EmploymentType, "employmentType", "Employment type", settings, false);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedEmployeeNumber = string.IsNullOrWhiteSpace(request.EmployeeNumber)
            ? null
            : request.EmployeeNumber.Trim().ToUpperInvariant();

        // Check for duplicate email within tenant
        var emailExists = await dbContext.Employees
            .AnyAsync(e => e.Email == normalizedEmail, cancellationToken);

        if (emailExists)
        {
            throw new DuplicateEntityException("Employee", "email", normalizedEmail);
        }

        if (!string.IsNullOrWhiteSpace(normalizedEmployeeNumber))
        {
            var employeeNumberExists = await dbContext.Employees
                .AnyAsync(e => e.EmployeeNumber == normalizedEmployeeNumber, cancellationToken);

            if (employeeNumberExists)
            {
                throw new DuplicateEntityException("Employee", "employeeNumber", normalizedEmployeeNumber);
            }
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
            jobTitle: request.JobTitle,
            employeeNumber: request.EmployeeNumber,
            phone: request.Phone,
            workLocation: request.WorkLocation,
            employmentType: request.EmploymentType);

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
            throw ResolveDuplicateException(ex, normalizedEmail, normalizedEmployeeNumber);
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

    private static void ValidateConfiguredRequiredField(
        string? requestedValue,
        string fieldKey,
        string displayName,
        TenantSettingsDto settings,
        bool fallbackRequired)
    {
        if (!IsFieldRequired(settings, fieldKey, fallbackRequired))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(requestedValue))
        {
            throw new ArgumentException($"{displayName} is required.", fieldKey);
        }
    }

    private static bool IsFieldRequired(TenantSettingsDto settings, string fieldKey, bool fallbackRequired)
        => OperationallyRequiredFields.Contains(fieldKey)
            || (settings.EmployeeFieldConfig.TryGetValue(fieldKey, out var fieldConfig)
                ? fieldConfig.Required
                : fallbackRequired);

    private static EmployeeDto MapToDto(Employee employee, Employee? manager, OrgUnit? orgUnit) => new(
        employee.Id,
        employee.TenantId,
        employee.EmployeeNumber,
        employee.FirstName,
        employee.LastName,
        employee.PreferredName,
        employee.Email,
        employee.Phone,
        employee.OrgUnitId,
        orgUnit?.Name,
        employee.JobTitle,
        employee.WorkLocation,
        employee.EmploymentType,
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

    private static DuplicateEntityException ResolveDuplicateException(
        DbUpdateException ex,
        string normalizedEmail,
        string? normalizedEmployeeNumber)
    {
        if (ex.InnerException?.Message.Contains("IX_Employees_TenantId_EmployeeNumber") == true
            && !string.IsNullOrWhiteSpace(normalizedEmployeeNumber))
        {
            return new DuplicateEntityException("Employee", "employeeNumber", normalizedEmployeeNumber);
        }

        return new DuplicateEntityException("Employee", "email", normalizedEmail);
    }
}
