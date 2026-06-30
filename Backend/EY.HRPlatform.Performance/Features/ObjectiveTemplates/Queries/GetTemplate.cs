using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;

public sealed record GetTemplateQuery(Guid TemplateId) : IQuery<Result<TemplateDto>>;

public sealed class GetTemplateQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetTemplateQuery, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(GetTemplateQuery query, CancellationToken cancellationToken)
    {
        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == query.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", query.TemplateId));

        return TemplateMapper.ToTemplateDto(template);
    }
}
