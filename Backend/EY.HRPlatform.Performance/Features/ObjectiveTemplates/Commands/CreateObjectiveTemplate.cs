using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record CreateObjectiveTemplateCommand(
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight,
    string? SuccessMeasure = null,
    string? Target = null,
    ObjectiveTemplateLevel Level = ObjectiveTemplateLevel.Individual,
    Guid? ParentTemplateId = null) : ICommand<Result<ObjectiveTemplateDto>>;

public sealed class CreateObjectiveTemplateCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext) : ICommandHandler<CreateObjectiveTemplateCommand, Result<ObjectiveTemplateDto>>
{
    public async Task<Result<ObjectiveTemplateDto>> Handle(
        CreateObjectiveTemplateCommand request,
        CancellationToken cancellationToken)
    {
        var normalizedName = request.Name?.Trim() ?? string.Empty;
        var nameTaken = await dbContext.ObjectiveTemplates
            .AnyAsync(t => t.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (nameTaken)
        {
            return Result.Failure<ObjectiveTemplateDto>(
                Error.Conflict("ObjectiveTemplate.DuplicateName", $"An objective template named '{normalizedName}' already exists."));
        }

        var template = ObjectiveTemplate.Create(
            tenantContext.TenantId,
            request.Name!,
            request.Description,
            request.Category,
            request.DefaultWeight,
            request.SuccessMeasure,
            request.Target,
            request.Level,
            request.ParentTemplateId);

        dbContext.ObjectiveTemplates.Add(template);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ObjectiveTemplateMapper.ToDto(template);
    }
}
