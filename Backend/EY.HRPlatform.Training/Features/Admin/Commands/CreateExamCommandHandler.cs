using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class CreateExamCommandHandler : ICommandHandler<CreateExamCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateExamCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateExamCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure<Guid>(Error.Validation("Exam.TitleRequired", "Exam title is required."));

        if (request.PassingScore is < 1 or > 100)
            return Result.Failure<Guid>(Error.Validation("Exam.InvalidPassingScore", "Passing score must be between 1 and 100."));

        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        var alreadyHasExam = await _db.Exams
            .AnyAsync(e => e.TrainingId == request.TrainingId, cancellationToken);

        if (alreadyHasExam)
            return Result.Failure<Guid>(new Error("Exam.Conflict", "This training already has an exam. Update or delete it first."));

        var exam = new Exam(request.Title, request.PassingScore, request.TrainingId, request.Description, request.DurationMinutes);
        _db.Exams.Add(exam);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(exam.Id);
    }
}
