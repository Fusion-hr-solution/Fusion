using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record ArchiveObjectiveTemplateCommand(Guid TemplateId, uint ExpectedVersion) : ICommand<Result<ObjectiveTemplateDto>>;

public sealed record RestoreObjectiveTemplateCommand(Guid TemplateId, uint ExpectedVersion) : ICommand<Result<ObjectiveTemplateDto>>;

public sealed class ArchiveObjectiveTemplateCommandHandler(
    PerformanceDbContext dbContext) : ICommandHandler<ArchiveObjectiveTemplateCommand, Result<ObjectiveTemplateDto>>
{
    public Task<Result<ObjectiveTemplateDto>> Handle(ArchiveObjectiveTemplateCommand request, CancellationToken cancellationToken)
        => ObjectiveTemplateStatusMutation.ApplyAsync(
            dbContext, request.TemplateId, request.ExpectedVersion, template => template.Archive(), cancellationToken);
}

public sealed class RestoreObjectiveTemplateCommandHandler(
    PerformanceDbContext dbContext) : ICommandHandler<RestoreObjectiveTemplateCommand, Result<ObjectiveTemplateDto>>
{
    public Task<Result<ObjectiveTemplateDto>> Handle(RestoreObjectiveTemplateCommand request, CancellationToken cancellationToken)
        => ObjectiveTemplateStatusMutation.ApplyAsync(
            dbContext, request.TemplateId, request.ExpectedVersion, template => template.Restore(), cancellationToken);
}

internal static class ObjectiveTemplateStatusMutation
{
    public static async Task<Result<ObjectiveTemplateDto>> ApplyAsync(
        PerformanceDbContext dbContext,
        Guid templateId,
        uint expectedVersion,
        Action<ObjectiveTemplate> mutate,
        CancellationToken cancellationToken)
    {
        var template = await dbContext.ObjectiveTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId, cancellationToken);
        if (template is null)
        {
            return Result.Failure<ObjectiveTemplateDto>(Error.NotFound("ObjectiveTemplate", templateId));
        }

        ConcurrencyGuard.Ensure(template.Version, expectedVersion, nameof(ObjectiveTemplate), template.Id);
        mutate(template);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(ObjectiveTemplate), template.Id);
        }

        return ObjectiveTemplateMapper.ToDto(template);
    }
}
