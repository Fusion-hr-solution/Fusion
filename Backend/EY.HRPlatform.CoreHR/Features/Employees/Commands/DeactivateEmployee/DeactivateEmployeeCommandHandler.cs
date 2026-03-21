using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.DeactivateEmployee;

public sealed class DeactivateEmployeeCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<DeactivateEmployeeCommand, Result>
{
    public async Task<Result> Handle(DeactivateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            throw new EntityNotFoundException("Employee", request.EmployeeId);
        }

        employee.Deactivate();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
