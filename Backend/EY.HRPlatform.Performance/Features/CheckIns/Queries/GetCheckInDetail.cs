using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Queries;

public sealed record GetCheckInDetailQuery(Guid CheckInId) : IQuery<Result<CheckInDetailDto>>;

public sealed class GetCheckInDetailQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    EffectiveReviewerResolver reviewerResolver) : IQueryHandler<GetCheckInDetailQuery, Result<CheckInDetailDto>>
{
    public async Task<Result<CheckInDetailDto>> Handle(
        GetCheckInDetailQuery request,
        CancellationToken cancellationToken)
    {
        var callerEmployeeId = currentUser.EmployeeId;
        if (!callerEmployeeId.HasValue)
            return Result.Failure<CheckInDetailDto>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var checkIn = await dbContext.PerformanceCheckIns
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == request.CheckInId, cancellationToken);
        if (checkIn is null)
            return Result.Failure<CheckInDetailDto>(Error.NotFound("PerformanceCheckIn", request.CheckInId));

        var isEmployee = checkIn.EmployeeId == callerEmployeeId.Value;
        if (!isEmployee)
        {
            var reviewer = await reviewerResolver.ResolveForParticipantAsync(checkIn.CycleId, checkIn.EmployeeId, cancellationToken);
            if (reviewer != callerEmployeeId.Value)
                return Result.Failure<CheckInDetailDto>(Error.NotFound("PerformanceCheckIn", request.CheckInId));
        }

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CycleId == checkIn.CycleId && item.EmployeeId == checkIn.EmployeeId, cancellationToken);
        var employeeName = participant?.FullName ?? string.Empty;

        var actions = await dbContext.CheckInFollowUpActions
            .AsNoTracking()
            .Where(item => item.CheckInId == checkIn.Id)
            .OrderBy(item => item.DueDate)
            .ToListAsync(cancellationToken);

        return Result.Success(CheckInMapper.ToDetail(checkIn, employeeName, actions, DateTime.UtcNow));
    }
}
