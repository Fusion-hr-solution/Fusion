using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteExamQuestionCommandHandler : ICommandHandler<DeleteExamQuestionCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteExamQuestionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteExamQuestionCommand request, CancellationToken cancellationToken)
    {
        var question = await _db.ExamQuestions
            .Include(q => q.Exam)
            .FirstOrDefaultAsync(q => q.Id == request.QuestionId
                                   && q.ExamId == request.ExamId
                                   && q.Exam.TrainingId == request.TrainingId, cancellationToken);

        if (question is null)
            return Result.Failure(Error.NotFound("ExamQuestion", request.QuestionId));

        _db.ExamQuestions.Remove(question);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
