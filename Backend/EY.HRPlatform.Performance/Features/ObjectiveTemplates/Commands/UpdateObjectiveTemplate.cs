using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record UpdateObjectiveTemplateCommand(
    Guid TemplateId,
    uint ExpectedVersion,
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight) : ICommand<Result<ObjectiveTemplateDto>>;

public sealed class UpdateObjectiveTemplateCommandHandler(
    PerformanceDbContext dbContext) : ICommandHandler<UpdateObjectiveTemplateCommand, Result<ObjectiveTemplateDto>>
{
    public async Task<Result<ObjectiveTemplateDto>> Handle(
        UpdateObjectiveTemplateCommand request,
        CancellationToken cancellationToken)
    {
        var template = await dbContext.ObjectiveTemplates
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId, cancellationToken);
        if (template is null)
        {
            return Result.Failure<ObjectiveTemplateDto>(Error.NotFound("ObjectiveTemplate", request.TemplateId));
        }

        var normalizedName = request.Name?.Trim() ?? string.Empty;
        var nameTaken = await dbContext.ObjectiveTemplates
            .AnyAsync(t => t.Id != template.Id && t.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (nameTaken)
        {
            return Result.Failure<ObjectiveTemplateDto>(
                Error.Conflict("ObjectiveTemplate.DuplicateName", $"An objective template named '{normalizedName}' already exists."));
        }

        ConcurrencyGuard.Ensure(template.Version, request.ExpectedVersion, nameof(ObjectiveTemplate), template.Id);
        template.UpdateDetails(request.Name!, request.Description, request.Category, request.DefaultWeight);

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
