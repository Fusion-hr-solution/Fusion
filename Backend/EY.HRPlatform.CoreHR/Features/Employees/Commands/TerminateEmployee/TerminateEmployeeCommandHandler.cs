using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.TerminateEmployee;

public sealed class TerminateEmployeeCommandHandler(
    CoreHRDbContext dbContext,
    IWorkforceMutationService workforceMutationService)
    : ICommandHandler<TerminateEmployeeCommand, Result>
{
    public async Task<Result> Handle(TerminateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            throw new EntityNotFoundException("Employee", request.EmployeeId);
        }

        if (employee.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("Employee", request.EmployeeId);
        }

        var terminationResult = await workforceMutationService.TerminateEmployeeAsync(
            request.EmployeeId,
            new TerminateEmployeeInput(request.EffectiveDate, request.Note),
            actor: null,
            cancellationToken);
        if (terminationResult.IsFailure)
        {
            return Result.Failure(terminationResult.Error);
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("Employee", request.EmployeeId);
        }

        return Result.Success();
    }
}
