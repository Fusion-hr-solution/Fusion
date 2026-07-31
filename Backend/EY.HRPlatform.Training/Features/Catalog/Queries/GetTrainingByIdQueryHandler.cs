using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Catalog.Queries;

public class GetTrainingByIdQueryHandler : IQueryHandler<GetTrainingByIdQuery, Result<TrainingDetailDto>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingByIdQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainingDetailDto>> Handle(GetTrainingByIdQuery request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .AsNoTracking()
            .Include(t => t.Category)
            .Include(t => t.Chapters)
                .ThenInclude(c => c.ContentBlocks)
            .Include(t => t.Exams)
                .ThenInclude(e => e.Questions)
            .Include(t => t.OnSiteCourses.OrderBy(c => c.OrderIndex))
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure<TrainingDetailDto>(new Error("Training.NotFound", $"Training with id '{request.TrainingId}' was not found."));

        var ratings = await _db.TrainingFeedbacks
            .AsNoTracking()
            .Where(f => f.TrainingId == request.TrainingId)
            .GroupBy(f => f.TrainingId)
            .Select(g => new { Count = g.Count(), Avg = g.Average(f => (double)f.OverallRating) })
            .FirstOrDefaultAsync(cancellationToken);

        var dto = new TrainingDetailDto
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
            TrainingType = training.TrainingType.ToString(),
            CostType = training.CostType.ToString(),
            SponsoringServiceLineId = training.SponsoringServiceLineId,
            ScheduledDate = training.ScheduledDate,
            CreatedAt = training.CreatedAt,
            AverageRating = ratings is null ? null : Math.Round(ratings.Avg, 2),
            RatingCount = ratings?.Count ?? 0,
            Chapters = training.Chapters
                .OrderBy(c => c.OrderIndex)
                .Select(c => new ChapterDto
                {
                    Id = c.Id,
                    Title = c.Title,
                    Layout = c.Layout.ToString(),
                    OrderIndex = c.OrderIndex,
                    BlockCount = c.ContentBlocks.Count
                })
                .ToList(),
            Exams = training.Exams
                .Select(e => new ExamDto
                {
                    Id = e.Id,
                    Title = e.Title,
                    PassingScore = e.PassingScore,
                    QuestionCount = e.Questions.Count
                })
                .ToList(),
            OnSiteCourses = training.OnSiteCourses.Select(c => new OnSiteCourseDto
            {
                Id = c.Id,
                Title = c.Title,
                ContentUri = c.ContentUri,
                OrderIndex = c.OrderIndex,
                CreatedAt = c.CreatedAt
            }).ToList()
        };

        return Result.Success(dto);
    }
}
