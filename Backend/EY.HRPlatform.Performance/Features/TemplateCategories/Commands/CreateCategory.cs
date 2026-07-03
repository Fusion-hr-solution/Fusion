using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.TemplateCategories.Commands;

public sealed record CreateCategoryCommand(
    ClaimsPrincipal Actor,
    CreateCategoryRequest Request) : ICommand<Result<CategoryDto>>;

public sealed class CreateCategoryCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateCategoryCommand, Result<CategoryDto>>
{
    public async Task<Result<CategoryDto>> Handle(
        CreateCategoryCommand command,
        CancellationToken cancellationToken)
    {
        var req = command.Request;
        var normalizedCode = req.Code.Trim().ToUpperInvariant();
        var normalizedName = req.Name.Trim().ToLowerInvariant();

        // Reject duplicate code or name
        var exists = await db.ObjectiveTemplateCategories
            .AnyAsync(c => c.Code == normalizedCode || c.NormalizedName == normalizedName, cancellationToken);

        if (exists)
            return Result.Failure<CategoryDto>(
                Error.Conflict("TemplateCategory.DuplicateCodeOrName",
                    "A category with this code or name already exists."));

        var category = ObjectiveTemplateCategory.Create(tenantContext.TenantId, req.Code, req.Name, req.Description);
        db.ObjectiveTemplateCategories.Add(category);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "CategoryCreated",
            "ObjectiveTemplateCategory",
            category.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new CategoryDto(category.Id, category.Code, category.Name, category.Description, category.Status.ToString());
    }
}
