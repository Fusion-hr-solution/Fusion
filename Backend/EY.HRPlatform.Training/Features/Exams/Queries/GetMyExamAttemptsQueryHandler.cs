using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Exams.Queries;

public class GetMyExamAttemptsQueryHandler : IQueryHandler<GetMyExamAttemptsQuery, Result<List<ExamAttemptDto>>>
{
    private readonly TrainingDbContext _db;

    public GetMyExamAttemptsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<ExamAttemptDto>>> Handle(GetMyExamAttemptsQuery request, CancellationToken cancellationToken)
    {
        var attempts = await _db.ExamAttempts
            .AsNoTracking()
            .Where(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId)
            .OrderByDescending(a => a.AttemptedAt)
            .Select(a => new ExamAttemptDto
            {
                Id = a.Id,
                ExamId = a.ExamId,
                Score = a.Score,
                TotalQuestions = a.TotalQuestions,
                CorrectAnswers = a.CorrectAnswers,
                Passed = a.Passed,
                AttemptedAt = a.AttemptedAt
            })
            .ToListAsync(cancellationToken);

        return Result.Success(attempts);
    }
}
