using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Configuration.Queries;

public sealed record ListEvaluationRatingScalesQuery(
    ClaimsPrincipal Actor,
    EvaluationConfigStatus? Status = null)
    : IQuery<Result<IReadOnlyList<EvaluationRatingScaleDto>>>;

public sealed record GetEvaluationRatingScaleQuery(ClaimsPrincipal Actor, Guid ScaleId)
    : IQuery<Result<EvaluationRatingScaleDto>>;

public sealed record ListEvaluationTemplatesQuery(
    ClaimsPrincipal Actor,
    EvaluationConfigStatus? Status = null)
    : IQuery<Result<IReadOnlyList<EvaluationTemplateDto>>>;

public sealed record GetEvaluationTemplateQuery(ClaimsPrincipal Actor, Guid TemplateId)
    : IQuery<Result<EvaluationTemplateDto>>;

public sealed record PreviewEvaluationTemplateQuery(
    ClaimsPrincipal Actor,
    Guid TemplateId,
    EvaluationTargetRater Rater)
    : IQuery<Result<EvaluationTemplatePreview>>;

public sealed class ListEvaluationRatingScalesQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<ListEvaluationRatingScalesQuery, Result<IReadOnlyList<EvaluationRatingScaleDto>>>
{
    public async Task<Result<IReadOnlyList<EvaluationRatingScaleDto>>> Handle(
        ListEvaluationRatingScalesQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(query.Actor))
            return EvaluationConfigurationErrors.Forbidden<IReadOnlyList<EvaluationRatingScaleDto>>();

        var source = db.EvaluationRatingScales.AsNoTracking().Include(scale => scale.Levels).AsQueryable();
        if (query.Status.HasValue)
            source = source.Where(scale => scale.Status == query.Status.Value);

        var scales = await source
            .OrderBy(scale => scale.Status)
            .ThenBy(scale => scale.Name)
            .ToListAsync(cancellationToken);
        return scales.Select(EvaluationConfigurationMapper.ToDto).ToArray();
    }
}

public sealed class GetEvaluationRatingScaleQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<GetEvaluationRatingScaleQuery, Result<EvaluationRatingScaleDto>>
{
    public async Task<Result<EvaluationRatingScaleDto>> Handle(
        GetEvaluationRatingScaleQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(query.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationRatingScaleDto>();

        var scale = await db.EvaluationRatingScales
            .AsNoTracking()
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.Id == query.ScaleId, cancellationToken);
        return scale is null
            ? Result.Failure<EvaluationRatingScaleDto>(Error.NotFound("EvaluationRatingScale", query.ScaleId))
            : EvaluationConfigurationMapper.ToDto(scale);
    }
}

public sealed class ListEvaluationTemplatesQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<ListEvaluationTemplatesQuery, Result<IReadOnlyList<EvaluationTemplateDto>>>
{
    public async Task<Result<IReadOnlyList<EvaluationTemplateDto>>> Handle(
        ListEvaluationTemplatesQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(query.Actor))
            return EvaluationConfigurationErrors.Forbidden<IReadOnlyList<EvaluationTemplateDto>>();

        var source = db.EvaluationTemplates
            .AsNoTracking()
            .AsSplitQuery()
            .Include(template => template.Sections)
            .Include(template => template.Questions)
            .AsQueryable();
        if (query.Status.HasValue)
            source = source.Where(template => template.Status == query.Status.Value);

        var templates = await source
            .OrderBy(template => template.Status)
            .ThenBy(template => template.Name)
            .ToListAsync(cancellationToken);
        return templates.Select(EvaluationConfigurationMapper.ToDto).ToArray();
    }
}

public sealed class GetEvaluationTemplateQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<GetEvaluationTemplateQuery, Result<EvaluationTemplateDto>>
{
    public async Task<Result<EvaluationTemplateDto>> Handle(
        GetEvaluationTemplateQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(query.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationTemplateDto>();

        var template = await LoadTemplateAsync(db, query.TemplateId, cancellationToken);
        return template is null
            ? Result.Failure<EvaluationTemplateDto>(Error.NotFound("EvaluationTemplate", query.TemplateId))
            : EvaluationConfigurationMapper.ToDto(template);
    }

    internal static Task<EvaluationTemplate?> LoadTemplateAsync(
        PerformanceDbContext db,
        Guid templateId,
        CancellationToken cancellationToken) => db.EvaluationTemplates
            .AsNoTracking()
            .AsSplitQuery()
            .Include(template => template.Sections)
            .Include(template => template.Questions)
            .SingleOrDefaultAsync(template => template.Id == templateId, cancellationToken);
}

public sealed class PreviewEvaluationTemplateQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<PreviewEvaluationTemplateQuery, Result<EvaluationTemplatePreview>>
{
    public async Task<Result<EvaluationTemplatePreview>> Handle(
        PreviewEvaluationTemplateQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(query.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationTemplatePreview>();

        var template = await GetEvaluationTemplateQueryHandler.LoadTemplateAsync(
            db, query.TemplateId, cancellationToken);
        if (template is null)
            return Result.Failure<EvaluationTemplatePreview>(Error.NotFound("EvaluationTemplate", query.TemplateId));

        try
        {
            return template.PreviewFor(query.Rater);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationTemplatePreview>(ex);
        }
    }
}
