using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAdminTrainingDetailQueryHandler : IQueryHandler<GetAdminTrainingDetailQuery, Result<AdminTrainingDetailDto>>
{
    private readonly TrainingDbContext _db;

    public GetAdminTrainingDetailQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AdminTrainingDetailDto>> Handle(
        GetAdminTrainingDetailQuery request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .IgnoreQueryFilters()
            .Include(t => t.Category)
            .Include(t => t.Chapters.OrderBy(c => c.OrderIndex))
            .Include(t => t.Exams)
            .ThenInclude(e => e.Questions)
            .Include(t => t.Assignments)
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure<AdminTrainingDetailDto>(Error.NotFound("Training", request.TrainingId));

        var dto = new AdminTrainingDetailDto
        {
            Id = training.Id,
            Title = training.Title,
            Description = training.Description,
            Credits = training.Credits,
            IsMandatory = training.IsMandatory,
            BadgeLevel = training.BadgeLevel.ToString(),
            Duration = training.Duration,
            CategoryId = training.CategoryId,
            CategoryName = training.Category.Name,
            EnrollmentCount = training.Assignments.Count,
            IsDeleted = training.IsDeleted,
            CreatedAt = training.CreatedAt,
            UpdatedAt = training.UpdatedAt,
            Chapters = training.Chapters.Select(c => new AdminChapterDto
            {
                Id = c.Id,
                Title = c.Title,
                ContentType = c.ContentType.ToString(),
                ContentUri = c.ContentUri,
                OrderIndex = c.OrderIndex,
                TextContent = c.TextContent,
                VideoUrl = c.VideoUrl,
                EstimatedDurationMinutes = c.EstimatedDurationMinutes,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }).ToList(),
            Exams = training.Exams.Select(e => new ExamDto
            {
                Id = e.Id,
                Title = e.Title,
                PassingScore = e.PassingScore,
                QuestionCount = e.Questions.Count
            }).ToList()
        };

        return Result.Success(dto);
    }
}
