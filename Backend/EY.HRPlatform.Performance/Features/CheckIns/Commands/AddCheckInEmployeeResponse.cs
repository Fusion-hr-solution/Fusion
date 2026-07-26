using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Commands;

public sealed record AddCheckInEmployeeResponseCommand(Guid CheckInId, AddCheckInEmployeeResponseRequest Request)
    : ICommand<Result<CheckInMutationResult>>;

public sealed class AddCheckInEmployeeResponseCommandHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard,
    ICurrentUserContext currentUser) : ICommandHandler<AddCheckInEmployeeResponseCommand, Result<CheckInMutationResult>>
{
    public async Task<Result<CheckInMutationResult>> Handle(
        AddCheckInEmployeeResponseCommand request,
        CancellationToken cancellationToken)
    {
        var checkInResult = await accessGuard.RequireEmployeeCheckInAsync(request.CheckInId, cancellationToken);
        if (checkInResult.IsFailure)
            return Result.Failure<CheckInMutationResult>(checkInResult.Error);
        var checkIn = checkInResult.Value;

        try
        {
            checkIn.AddEmployeeResponse(checkIn.EmployeeId, currentUser.FullName ?? string.Empty, request.Request.Text, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<CheckInMutationResult>(Error.Validation("CheckIn.ResponseInvalid", exception.Message));
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<CheckInMutationResult>(CheckInConflicts.Stale());
        }

        return Result.Success(new CheckInMutationResult(checkIn.Id, checkIn.Status, checkIn.Version));
    }
}
