using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateOwnEmployeeProfile;

public sealed class UpdateOwnEmployeeProfileCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<UpdateOwnEmployeeProfileCommand, Result>
{
    public async Task<Result> Handle(UpdateOwnEmployeeProfileCommand request, CancellationToken cancellationToken)
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

        employee.UpdatePreferredName(request.PreferredName);

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
