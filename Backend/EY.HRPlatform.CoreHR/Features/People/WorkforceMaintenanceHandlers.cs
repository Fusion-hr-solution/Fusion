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

public sealed record DottedLineRequest(DateTime EffectiveDate, Guid ManagerEmployeeId);

public sealed record UpdateWorkEmailRequest(
    [property: Required, EmailAddress, MaxLength(256)] string WorkEmail);

// --- Contracts ------------------------------------------------------------------------------------

public sealed record MaintenanceResultDto(string EmployeeKey, DateTime EffectiveDate, bool IsScheduled);

/// <param name="End">False adds the dotted line from the date; true ends it on the date.</param>
public sealed record DottedLineCommand(
    string EmployeeKey,
    DateTime EffectiveDate,
    Guid ManagerEmployeeId,
    bool End,
    string Actor) : ICommand<Result<MaintenanceResultDto>>;

public sealed record UpdateWorkEmailCommand(
    string EmployeeKey,
    uint ExpectedVersion,
    string WorkEmail,
    string Actor) : ICommand<Result<Employee>>;

// --- Handlers -------------------------------------------------------------------------------------

public sealed class DottedLineCommandHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService mutationService)
    : ICommandHandler<DottedLineCommand, Result<MaintenanceResultDto>>
{
    public async Task<Result<MaintenanceResultDto>> Handle(DottedLineCommand command, CancellationToken cancellationToken)
    {
        var employee = await MaintenanceSupport.FindEmployeeAsync(dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<MaintenanceResultDto>(new Error("Employee.NotFound", "Employee was not found."));

        var effective = MaintenanceSupport.NormalizeDate(command.EffectiveDate);
        var today = DateTime.UtcNow.Date;
        var input = new ChangeManagerInput(command.ManagerEmployeeId, effective, WorkforceSourceType.Manual);

        return await MaintenanceSupport.RunAsync(dbContext, async () =>
        {
            var changed = command.End
                ? await mutationService.EndDottedLineManagerAsync(employee.Id, input, command.Actor, cancellationToken)
                : await mutationService.AddDottedLineManagerAsync(employee.Id, input, command.Actor, cancellationToken);
            return changed.IsFailure
                ? Result.Failure<MaintenanceResultDto>(changed.Error)
                : Result.Success(new MaintenanceResultDto(employee.StableEmployeeKey, effective, effective > today));
        }, cancellationToken);
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
