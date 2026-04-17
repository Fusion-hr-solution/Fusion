using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteExamCommandHandler : ICommandHandler<DeleteExamCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteExamCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteExamCommand request, CancellationToken cancellationToken)
    {
        var exam = await _db.Exams
            .FirstOrDefaultAsync(e => e.Id == request.ExamId && e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure(Error.NotFound("Exam", request.ExamId));

        _db.Exams.Remove(exam);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
