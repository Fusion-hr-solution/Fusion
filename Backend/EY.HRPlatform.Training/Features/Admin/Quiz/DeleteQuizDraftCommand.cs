using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>US-8.2.5 — discard a training's quiz draft. Idempotent: no draft is still success.</summary>
public record DeleteQuizDraftCommand(Guid TrainingId) : ICommand<Result>;

public class DeleteQuizDraftCommandHandler : ICommandHandler<DeleteQuizDraftCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteQuizDraftCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteQuizDraftCommand request, CancellationToken cancellationToken)
    {
        var draft = await _db.QuizDrafts.FirstOrDefaultAsync(d => d.TrainingId == request.TrainingId, cancellationToken);
        if (draft is not null)
        {
            _db.QuizDrafts.Remove(draft);
            await _db.SaveChangesAsync(cancellationToken);
        }
        return Result.Success();
    }
}
