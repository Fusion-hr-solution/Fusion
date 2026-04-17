using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Exams.Queries;

public class GetExamForLearnerQueryHandler : IQueryHandler<GetExamForLearnerQuery, Result<ExamForLearnerDto>>
{
    private readonly TrainingDbContext _db;

    public GetExamForLearnerQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<ExamForLearnerDto>> Handle(GetExamForLearnerQuery request, CancellationToken cancellationToken)
    {
        // Must be enrolled
        var isEnrolled = await _db.Assignments
            .AsNoTracking()
            .AnyAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId, cancellationToken);

        if (!isEnrolled)
            return Result.Failure<ExamForLearnerDto>(new Error("Enrollment.NotFound", "You are not enrolled in this training."));

        // Must have completed all chapters
        var eligibility = await ExamEligibility.EvaluateAsync(_db, request.EmployeeId, request.TrainingId, cancellationToken);
        if (!eligibility.AllChaptersCompleted)
            return Result.Failure<ExamForLearnerDto>(new Error("Exam.Locked",
                "The exam is locked. Complete all chapters first."));

        var exam = await _db.Exams
            .AsNoTracking()
            .Include(e => e.Questions.OrderBy(q => q.OrderIndex))
                .ThenInclude(q => q.Options.OrderBy(o => o.OrderIndex))
            .FirstOrDefaultAsync(e => e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure<ExamForLearnerDto>(Error.NotFound("Exam for training", request.TrainingId));

        var dto = new ExamForLearnerDto
        {
            Id = exam.Id,
            TrainingId = exam.TrainingId,
            Title = exam.Title,
            Description = exam.Description,
            PassingScore = exam.PassingScore,
            DurationMinutes = exam.DurationMinutes,
            QuestionCount = exam.Questions.Count,
            Questions = exam.Questions.Select(q => new ExamQuestionForLearnerDto
            {
                Id = q.Id,
                QuestionText = q.QuestionText,
                Type = q.Type.ToString(),
                OrderIndex = q.OrderIndex,
                Points = q.Points,
                Options = q.Options.Select(o => new ExamOptionForLearnerDto
                {
                    Id = o.Id,
                    OptionText = o.OptionText,
                    OrderIndex = o.OrderIndex
                }).ToList()
            }).ToList()
        };

        return Result.Success(dto);
    }
}
