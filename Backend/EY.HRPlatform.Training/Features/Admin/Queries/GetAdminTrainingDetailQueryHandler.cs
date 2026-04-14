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
                .ThenInclude(c => c.ContentBlocks.OrderBy(b => b.OrderIndex))
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
                Layout = c.Layout.ToString(),
                OrderIndex = c.OrderIndex,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                ContentBlocks = c.ContentBlocks.Select(b => new AdminContentBlockDto
                {
                    Id = b.Id,
                    Type = b.Type.ToString(),
                    OrderIndex = b.OrderIndex,
                    Title = b.Title,
                    TextContent = b.TextContent,
                    ContentUri = b.ContentUri,
                    VideoUrl = b.VideoUrl,
                    EstimatedDurationMinutes = b.EstimatedDurationMinutes,
                    CreatedAt = b.CreatedAt,
                    UpdatedAt = b.UpdatedAt
                }).ToList()
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
