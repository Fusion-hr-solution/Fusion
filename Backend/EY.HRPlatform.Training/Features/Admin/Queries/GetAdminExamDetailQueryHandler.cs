using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAdminExamDetailQueryHandler : IQueryHandler<GetAdminExamDetailQuery, Result<AdminExamDetailDto>>
{
    private readonly TrainingDbContext _db;

    public GetAdminExamDetailQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AdminExamDetailDto>> Handle(GetAdminExamDetailQuery request, CancellationToken cancellationToken)
    {
        var exam = await _db.Exams
            .AsNoTracking()
            .Include(e => e.Questions.OrderBy(q => q.OrderIndex))
                .ThenInclude(q => q.Options.OrderBy(o => o.OrderIndex))
            .FirstOrDefaultAsync(e => e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure<AdminExamDetailDto>(Error.NotFound("Exam for training", request.TrainingId));

        var dto = new AdminExamDetailDto
        {
            Id = exam.Id,
            TrainingId = exam.TrainingId,
            Title = exam.Title,
            Description = exam.Description,
            PassingScore = exam.PassingScore,
            DurationMinutes = exam.DurationMinutes,
            CreatedAt = exam.CreatedAt,
            UpdatedAt = exam.UpdatedAt,
            Questions = exam.Questions.Select(q => new AdminExamQuestionDto
            {
                Id = q.Id,
                QuestionText = q.QuestionText,
                Type = q.Type.ToString(),
                OrderIndex = q.OrderIndex,
                Points = q.Points,
                Explanation = q.Explanation,
                Options = q.Options.Select(o => new AdminExamOptionDto
                {
                    Id = o.Id,
                    OptionText = o.OptionText,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = o.OrderIndex
                }).ToList()
            }).ToList()
        };

        return Result.Success(dto);
    }
}
