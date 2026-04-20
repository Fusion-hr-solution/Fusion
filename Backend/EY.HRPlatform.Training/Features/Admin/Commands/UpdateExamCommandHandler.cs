using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateExamCommandHandler : ICommandHandler<UpdateExamCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateExamCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateExamCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure(Error.Validation("Exam.TitleRequired", "Exam title is required."));

        if (request.PassingScore is < 1 or > 100)
            return Result.Failure(Error.Validation("Exam.InvalidPassingScore", "Passing score must be between 1 and 100."));

        var exam = await _db.Exams
            .FirstOrDefaultAsync(e => e.Id == request.ExamId && e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure(Error.NotFound("Exam", request.ExamId));

        exam.Update(request.Title, request.PassingScore, request.Description, request.DurationMinutes);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
