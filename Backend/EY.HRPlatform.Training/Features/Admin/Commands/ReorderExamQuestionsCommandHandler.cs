using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class ReorderExamQuestionsCommandHandler : ICommandHandler<ReorderExamQuestionsCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderExamQuestionsCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderExamQuestionsCommand request, CancellationToken cancellationToken)
    {
        var exam = await _db.Exams
            .FirstOrDefaultAsync(e => e.Id == request.ExamId && e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure(Error.NotFound("Exam", request.ExamId));

        var questions = await _db.ExamQuestions
            .Where(q => q.ExamId == request.ExamId)
            .ToListAsync(cancellationToken);

        if (questions.Count != request.QuestionIds.Count || !request.QuestionIds.All(id => questions.Any(q => q.Id == id)))
            return Result.Failure(Error.Validation("Exam.ReorderMismatch",
                "Provided question ids do not match the exam's current questions."));

        for (var i = 0; i < request.QuestionIds.Count; i++)
        {
            var q = questions.First(x => x.Id == request.QuestionIds[i]);
            q.SetOrderIndex(i);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
