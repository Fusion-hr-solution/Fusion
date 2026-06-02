using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;

public sealed class UpdateEmployeeCommandHandler(
    CoreHRDbContext dbContext,
    IEmployeeHierarchyService hierarchyService,
    ITenantSettingsReadService? tenantSettingsReadService = null) : ICommandHandler<UpdateEmployeeCommand, Result<EmployeeDto>>
{
    private readonly IEmployeeHierarchyService employeeHierarchyService = hierarchyService;
    private readonly ITenantSettingsReadService tenantSettingsReader =
        tenantSettingsReadService ?? new TenantSettingsReadService(dbContext);
    private static readonly HashSet<string> OperationallyRequiredFields =
        ["firstName", "lastName", "email", "hireDate"];

    public async Task<Result<EmployeeDto>> Handle(UpdateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            throw new EntityNotFoundException("Employee", request.EmployeeId);
        }

        // Verify expected version for optimistic concurrency
        if (employee.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("Employee", request.EmployeeId);
        }

        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);
        ValidateConfiguredRequiredField(request.FirstName, "firstName", "First name", settings, true);
        ValidateConfiguredRequiredField(request.LastName, "lastName", "Last name", settings, true);
        ValidateConfiguredRequiredField(request.Email, "email", "Email", settings, true);
        ValidateConfiguredRequiredField(request.Phone, "phone", "Phone", settings, false);
        ValidateConfiguredRequiredField(request.JobTitle, "jobTitle", "Job title", settings, false);
        ValidateConfiguredRequiredField(request.WorkLocation, "workLocation", "Work location", settings, false);
        ValidateConfiguredRequiredField(request.EmploymentType, "employmentType", "Employment type", settings, false);

        // Merge request values with existing (partial update support)
        var firstName = request.FirstName ?? employee.FirstName;
        var lastName = request.LastName ?? employee.LastName;
        var email = request.Email ?? employee.Email;
        var phone = request.Phone ?? employee.Phone;
        var jobTitle = request.JobTitle ?? employee.JobTitle;
        var workLocation = request.WorkLocation ?? employee.WorkLocation;
        var employmentType = request.EmploymentType ?? employee.EmploymentType;
        var employeeNumber = request.EmployeeNumber ?? employee.EmployeeNumber;

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedEmployeeNumber = string.IsNullOrWhiteSpace(employeeNumber)
            ? null
            : employeeNumber.Trim().ToUpperInvariant();

        // Check for duplicate email within tenant (only if email is changing)
        if (normalizedEmail != employee.Email)
        {
            var emailExists = await dbContext.Employees
                .AnyAsync(e => e.Email == normalizedEmail && e.Id != request.EmployeeId, cancellationToken);

            if (emailExists)
            {
                throw new DuplicateEntityException("Employee", "email", normalizedEmail);
            }
        }

        if (!string.IsNullOrWhiteSpace(normalizedEmployeeNumber)
            && !string.Equals(normalizedEmployeeNumber, employee.EmployeeNumber, StringComparison.Ordinal))
        {
            var employeeNumberExists = await dbContext.Employees
                .AnyAsync(e => e.EmployeeNumber == normalizedEmployeeNumber && e.Id != request.EmployeeId, cancellationToken);

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

        // Update employee details
        employee.UpdateDetails(
            firstName,
            lastName,
            email,
            employee.Department,
            jobTitle,
            employeeNumber,
            phone,
            workLocation,
            employmentType);

        if (request.PreferredName is not null)
        {
            employee.UpdatePreferredName(request.PreferredName);
        }

        if (request.HireDate.HasValue)
        {
            employee.UpdateHireDate(request.HireDate.Value);
        }

        // Update manager only if explicitly provided in request
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

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("Employee", request.EmployeeId);
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

        if (employee.OrgUnitId.HasValue)
        {
            orgUnit ??= await dbContext.OrgUnits
                .FirstOrDefaultAsync(o => o.Id == employee.OrgUnitId.Value, cancellationToken);
        }

        return Result.Success(MapToDto(employee, manager, orgUnit));
    }

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

    private static void ValidateConfiguredRequiredField(
        string? requestedValue,
        string fieldKey,
        string displayName,
        TenantSettingsDto settings,
        bool fallbackRequired)
    {
        if (requestedValue is null || !IsFieldRequired(settings, fieldKey, fallbackRequired))
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
}
