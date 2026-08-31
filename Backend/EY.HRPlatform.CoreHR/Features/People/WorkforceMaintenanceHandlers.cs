using System.Data;
using System.ComponentModel.DataAnnotations;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.CoreHR.Features.People;

// --- API request bodies ---------------------------------------------------------------------------

public sealed record ChangeWorkRequest(DateTime EffectiveDate, Guid OrgUnitId, string JobTitle, string? Location);

public sealed record ChangeManagerByKeyRequest(DateTime EffectiveDate, Guid? ManagerEmployeeId);

public sealed record EndEmploymentRequest(DateTime LastEmployedDate, string? Note);

public sealed record UpdateWorkEmailRequest(
    [property: Required, EmailAddress, MaxLength(256)] string WorkEmail);

// --- Contracts ------------------------------------------------------------------------------------

public sealed record MaintenanceResultDto(string EmployeeKey, DateTime EffectiveDate, bool IsScheduled);

public sealed record AffectedReportDto(string DisplayName, string EmployeeNumber);

public sealed record EndEmploymentPreviewDto(
    DateTime LastEmployedDate,
    int DirectReportCount,
    IReadOnlyList<AffectedReportDto> DirectReports);

public sealed record ChangeWorkCommand(
    string EmployeeKey,
    DateTime EffectiveDate,
    Guid OrgUnitId,
    string JobTitle,
    string? Location,
    string Actor) : ICommand<Result<MaintenanceResultDto>>;

public sealed record ChangeManagerByKeyCommand(
    string EmployeeKey,
    DateTime EffectiveDate,
    Guid? ManagerEmployeeId,
    string Actor) : ICommand<Result<MaintenanceResultDto>>;

public sealed record EndEmploymentCommand(
    string EmployeeKey,
    DateTime LastEmployedDate,
    string? Note,
    string Actor) : ICommand<Result<MaintenanceResultDto>>;

public sealed record EndEmploymentPreviewQuery(
    string EmployeeKey,
    DateTime LastEmployedDate) : IQuery<Result<EndEmploymentPreviewDto>>;

public sealed record UpdateWorkEmailCommand(
    string EmployeeKey,
    uint ExpectedVersion,
    string WorkEmail,
    string Actor) : ICommand<Result<Employee>>;

// --- Handlers -------------------------------------------------------------------------------------

public sealed class ChangeWorkCommandHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService mutationService)
    : ICommandHandler<ChangeWorkCommand, Result<MaintenanceResultDto>>
{
    public async Task<Result<MaintenanceResultDto>> Handle(ChangeWorkCommand command, CancellationToken cancellationToken)
    {
        var employee = await MaintenanceSupport.FindEmployeeAsync(dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<MaintenanceResultDto>(new Error("Employee.NotFound", "Employee was not found."));

        var effective = MaintenanceSupport.NormalizeDate(command.EffectiveDate);
        var today = DateTime.UtcNow.Date;
        // Product rule for this action: Change Work is Today-or-future; the past is a separate correction.
        if (effective < today)
            return Result.Failure<MaintenanceResultDto>(Error.Validation(
                "WorkAssignment.PastDatedChange",
                "A work change must take effect today or later. Correcting a past record is a separate operation and is not available here."));

        if (string.IsNullOrWhiteSpace(command.JobTitle))
            return Result.Failure<MaintenanceResultDto>(Error.Validation(
                "WorkAssignment.JobTitleRequired", "Display title is required."));
        if (command.OrgUnitId == Guid.Empty)
            return Result.Failure<MaintenanceResultDto>(Error.Validation(
                "WorkAssignment.OrgUnitRequired", "Organization is required."));

        return await MaintenanceSupport.RunAsync(dbContext, async () =>
        {
            var result = await mutationService.ChangeWorkAssignmentAsync(
                employee.Id,
                new ChangeWorkAssignmentInput(command.OrgUnitId, command.JobTitle, command.Location, effective, WorkforceSourceType.Manual),
                command.Actor,
                cancellationToken);
            return result.IsFailure
                ? Result.Failure<MaintenanceResultDto>(result.Error)
                : Result.Success(new MaintenanceResultDto(employee.StableEmployeeKey, effective, effective > today));
        }, cancellationToken);
    }
}

public sealed class ChangeManagerByKeyCommandHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService mutationService)
    : ICommandHandler<ChangeManagerByKeyCommand, Result<MaintenanceResultDto>>
{
    public async Task<Result<MaintenanceResultDto>> Handle(ChangeManagerByKeyCommand command, CancellationToken cancellationToken)
    {
        var employee = await MaintenanceSupport.FindEmployeeAsync(dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<MaintenanceResultDto>(new Error("Employee.NotFound", "Employee was not found."));

        var effective = MaintenanceSupport.NormalizeDate(command.EffectiveDate);
        var today = DateTime.UtcNow.Date;

        return await MaintenanceSupport.RunAsync(dbContext, async () =>
        {
            if (command.ManagerEmployeeId is { } managerId && managerId != Guid.Empty)
            {
                var changed = await mutationService.ChangeManagerAsync(
                    employee.Id,
                    new ChangeManagerInput(managerId, effective, WorkforceSourceType.Manual),
                    command.Actor,
                    cancellationToken);
                if (changed.IsFailure)
                    return Result.Failure<MaintenanceResultDto>(changed.Error);
            }
            else
            {
                var removed = await mutationService.RemovePrimaryManagerAsync(
                    employee.Id, effective, WorkforceSourceType.Manual, sourceReference: null,
                    importBatchId: null, command.Actor, cancellationToken);
                if (removed.IsFailure)
                    return Result.Failure<MaintenanceResultDto>(removed.Error);
            }

            return Result.Success(new MaintenanceResultDto(employee.StableEmployeeKey, effective, effective > today));
        }, cancellationToken);
    }
}

public sealed class EndEmploymentCommandHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService mutationService)
    : ICommandHandler<EndEmploymentCommand, Result<MaintenanceResultDto>>
{
    public async Task<Result<MaintenanceResultDto>> Handle(EndEmploymentCommand command, CancellationToken cancellationToken)
    {
        var employee = await MaintenanceSupport.FindEmployeeAsync(dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<MaintenanceResultDto>(new Error("Employee.NotFound", "Employee was not found."));

        var lastEmployed = MaintenanceSupport.NormalizeDate(command.LastEmployedDate);
        var today = DateTime.UtcNow.Date;

        return await MaintenanceSupport.RunAsync(dbContext, async () =>
        {
            var result = await mutationService.EndEmploymentReleasingReportsAsync(
                employee.Id,
                new EndEmploymentInput(lastEmployed, command.Note, WorkforceSourceType.Manual),
                command.Actor,
                cancellationToken);
            return result.IsFailure
                ? Result.Failure<MaintenanceResultDto>(result.Error)
                : Result.Success(new MaintenanceResultDto(employee.StableEmployeeKey, lastEmployed, lastEmployed > today));
        }, cancellationToken);
    }
}

public sealed class EndEmploymentPreviewQueryHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService mutationService)
    : IQueryHandler<EndEmploymentPreviewQuery, Result<EndEmploymentPreviewDto>>
{
    public async Task<Result<EndEmploymentPreviewDto>> Handle(EndEmploymentPreviewQuery request, CancellationToken cancellationToken)
    {
        var employee = await MaintenanceSupport.FindEmployeeAsync(dbContext, request.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<EndEmploymentPreviewDto>(new Error("Employee.NotFound", "Employee was not found."));

        var lastEmployed = MaintenanceSupport.NormalizeDate(request.LastEmployedDate);
        var preview = await mutationService.PreviewEndEmploymentAsync(employee.Id, lastEmployed, cancellationToken);
        if (preview.IsFailure)
            return Result.Failure<EndEmploymentPreviewDto>(preview.Error);

        var reports = preview.Value.DirectReports
            .Select(report => new AffectedReportDto(report.DisplayName, report.EmployeeNumber))
            .ToList();
        return Result.Success(new EndEmploymentPreviewDto(preview.Value.LastEmployedDate, preview.Value.DirectReportCount, reports));
    }
}

public sealed class UpdateWorkEmailCommandHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService mutationService)
    : ICommandHandler<UpdateWorkEmailCommand, Result<Employee>>
{
    public async Task<Result<Employee>> Handle(
        UpdateWorkEmailCommand command,
        CancellationToken cancellationToken)
    {
        var employee = await MaintenanceSupport.FindEmployeeAsync(
            dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<Employee>(new Error("Employee.NotFound", "Employee was not found."));

        if (employee.Version != command.ExpectedVersion)
            throw new ConcurrencyException("Employee", employee.Id);

        var normalizedEmail = command.WorkEmail.Trim().ToLowerInvariant();
        if (string.Equals(employee.Email, normalizedEmail, StringComparison.Ordinal))
            return Result.Success(employee);

        return await MaintenanceSupport.RunAsync(dbContext, async () =>
        {
            var result = await mutationService.UpdateEmployeeProfileAsync(
                employee.Id,
                new UpdateEmployeeProfileInput(
                    employee.FirstName,
                    employee.LastName,
                    normalizedEmail,
                    employee.PreferredName,
                    employee.Phone),
                command.Actor,
                cancellationToken);

            return result.IsFailure
                ? Result.Failure<Employee>(result.Error)
                : Result.Success(employee);
        }, cancellationToken);
    }
}

// --- Shared support -------------------------------------------------------------------------------

internal static class MaintenanceSupport
{
    public static async Task<Employee?> FindEmployeeAsync(
        CoreHRDbContext dbContext, string employeeKey, CancellationToken cancellationToken)
    {
        var key = employeeKey.Trim().ToUpperInvariant();
        return await dbContext.Employees
            .FirstOrDefaultAsync(item => item.StableEmployeeKey == key, cancellationToken);
    }

    public static DateTime NormalizeDate(DateTime value)
        => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);

    /// <summary>Runs a staged mutation inside a single read-committed transaction, then commits.</summary>
    public static async Task<Result<T>> RunAsync<T>(
        CoreHRDbContext dbContext,
        Func<Task<Result<T>>> operation,
        CancellationToken cancellationToken)
    {
        var useTransaction = dbContext.Database.IsRelational();
        await using IDbContextTransaction? transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            : null;

        try
        {
            var result = await operation();
            if (result.IsFailure)
            {
                if (transaction is not null)
                    await transaction.RollbackAsync(cancellationToken);
                dbContext.ChangeTracker.Clear();
                return result;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
                await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            if (transaction is not null)
                await transaction.RollbackAsync(cancellationToken);
            dbContext.ChangeTracker.Clear();
            throw;
        }
    }
}
