using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateMyProfile;

public sealed class UpdateMyProfileCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<UpdateMyProfileCommand, Result<uint>>
{
    public async Task<Result<uint>> Handle(UpdateMyProfileCommand request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(currentEmployee => currentEmployee.Id == request.EmployeeId, cancellationToken);

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

        return Result.Success(employee.Version);
    }
}