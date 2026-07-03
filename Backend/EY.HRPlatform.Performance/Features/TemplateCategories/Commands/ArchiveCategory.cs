using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.TemplateCategories.Commands;

public sealed record ArchiveCategoryCommand(Guid CategoryId, ClaimsPrincipal Actor) : ICommand<Result<CategoryDto>>;

public sealed class ArchiveCategoryCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ArchiveCategoryCommand, Result<CategoryDto>>
{
    public async Task<Result<CategoryDto>> Handle(
        ArchiveCategoryCommand command,
        CancellationToken cancellationToken)
    {
        var category = await db.ObjectiveTemplateCategories
            .FirstOrDefaultAsync(c => c.Id == command.CategoryId, cancellationToken);

        if (category is null)
            return Result.Failure<CategoryDto>(
                new Error("TemplateCategory.NotFound", $"Category {command.CategoryId} not found."));

        // Check in-use: templates referencing this category retain it (safe archive)
        // Archiving does not remove templates from the category; it only prevents new assignments.
        category.Archive();

        await audit.AppendTenantAsync(
            category.TenantId,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "CategoryArchived",
            "ObjectiveTemplateCategory",
            category.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new CategoryDto(category.Id, category.Code, category.Name, category.Description, category.Status.ToString());
    }
}

public sealed record ReactivateCategoryCommand(Guid CategoryId, ClaimsPrincipal Actor) : ICommand<Result<CategoryDto>>;

public sealed class ReactivateCategoryCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ReactivateCategoryCommand, Result<CategoryDto>>
{
    public async Task<Result<CategoryDto>> Handle(
        ReactivateCategoryCommand command,
        CancellationToken cancellationToken)
    {
        var category = await db.ObjectiveTemplateCategories
            .FirstOrDefaultAsync(c => c.Id == command.CategoryId, cancellationToken);

        if (category is null)
            return Result.Failure<CategoryDto>(
                new Error("TemplateCategory.NotFound", $"Category {command.CategoryId} not found."));

        category.Reactivate();

        await audit.AppendTenantAsync(
            category.TenantId,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "CategoryReactivated",
            "ObjectiveTemplateCategory",
            category.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new CategoryDto(category.Id, category.Code, category.Name, category.Description, category.Status.ToString());
    }
}
