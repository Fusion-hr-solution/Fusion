using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.TemplateCategories.Commands;

public sealed record RenameCategoryCommand(
    Guid CategoryId,
    ClaimsPrincipal Actor,
    RenameCategoryRequest Request) : ICommand<Result<CategoryDto>>;

public sealed class RenameCategoryCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<RenameCategoryCommand, Result<CategoryDto>>
{
    public async Task<Result<CategoryDto>> Handle(
        RenameCategoryCommand command,
        CancellationToken cancellationToken)
    {
        var category = await db.ObjectiveTemplateCategories
            .FirstOrDefaultAsync(c => c.Id == command.CategoryId, cancellationToken);

        if (category is null)
            return Result.Failure<CategoryDto>(
                new Error("TemplateCategory.NotFound", $"Category {command.CategoryId} not found."));

        var newNormalized = command.Request.Name.Trim().ToLowerInvariant();
        var nameConflict = await db.ObjectiveTemplateCategories
            .AnyAsync(c => c.NormalizedName == newNormalized && c.Id != command.CategoryId, cancellationToken);

        if (nameConflict)
            return Result.Failure<CategoryDto>(
                Error.Conflict("TemplateCategory.DuplicateName",
                    "A category with this name already exists."));

        var previousValue = category.Name;
        category.Rename(command.Request.Name, command.Request.Description);

        await audit.AppendTenantAsync(
            category.TenantId,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "CategoryRenamed",
            "ObjectiveTemplateCategory",
            category.Id,
            previousValue: previousValue,
            newValue: category.Name,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new CategoryDto(category.Id, category.Code, category.Name, category.Description, category.Status.ToString());
    }
}
