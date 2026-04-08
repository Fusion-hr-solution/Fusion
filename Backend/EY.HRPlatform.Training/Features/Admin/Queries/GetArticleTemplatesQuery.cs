using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetArticleTemplatesQuery : IQuery<Result<List<ArticleTemplateDto>>>;

public class GetArticleTemplatesQueryHandler : IQueryHandler<GetArticleTemplatesQuery, Result<List<ArticleTemplateDto>>>
{
    private readonly TrainingDbContext _db;

    public GetArticleTemplatesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<ArticleTemplateDto>>> Handle(
        GetArticleTemplatesQuery request, CancellationToken cancellationToken)
    {
        var templates = await _db.ArticleTemplates
            .AsNoTracking()
            .Include(t => t.Sections.OrderBy(s => s.OrderIndex))
            .OrderBy(t => t.Name)
            .Select(t => new ArticleTemplateDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Sections = t.Sections.OrderBy(s => s.OrderIndex).Select(s => new ArticleTemplateSectionDto
                {
                    Id = s.Id,
                    Label = s.Label,
                    Placeholder = s.Placeholder,
                    OrderIndex = s.OrderIndex,
                }).ToList(),
            })
            .ToListAsync(cancellationToken);

        return Result.Success(templates);
    }
}
