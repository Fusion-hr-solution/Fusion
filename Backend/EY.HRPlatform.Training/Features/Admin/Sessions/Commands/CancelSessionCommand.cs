using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

public record CancelSessionCommand(Guid SessionId, string Reason) : ICommand<Result>;

public class CancelSessionCommandHandler : ICommandHandler<CancelSessionCommand, Result>
{
    private readonly TrainingDbContext _db;

    public CancelSessionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(CancelSessionCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure(Error.Validation("Session.CancelReasonRequired", "Cancellation reason is required."));

        var session = await _db.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure(Error.NotFound("TrainingSession", request.SessionId));

        if (session.Status == SessionStatus.Cancelled)
            return Result.Failure(Error.Validation("Session.AlreadyCancelled", "Session is already cancelled."));

        if (session.Status == SessionStatus.Completed)
            return Result.Failure(Error.Validation("Session.CannotCancelCompleted", "Cannot cancel a completed session."));

        session.Cancel(request.Reason.Trim());
        _db.CalendarSyncOutboxes.Add(new CalendarSyncOutbox(CalendarSyncType.SessionCancelled, request.SessionId));
        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
