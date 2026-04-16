using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.CreateDraftOrgUnit;

public sealed class CreateDraftOrgUnitCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : ICommandHandler<CreateDraftOrgUnitCommand, Result<DraftOrgUnitDto>>
{
    private const string StructureItem = "Structure item";
    private const string ParentStructureItem = "Parent structure item";

    public async Task<Result<DraftOrgUnitDto>> Handle(
        CreateDraftOrgUnitCommand request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var tenantId = tenantContext.TenantId;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var normalizedName = request.Name.Trim();

        await DraftStructureRules.ValidateTypeAsync(dbContext, request.Type, cancellationToken);

        var codeExists = await dbContext.DraftOrgUnits
            .AnyAsync(o => o.Code == normalizedCode, cancellationToken);

        if (codeExists)
        {
            throw new DuplicateEntityException(StructureItem, "code", normalizedCode);
        }

        var nameExists = await dbContext.DraftOrgUnits
            .AnyAsync(o => o.Name == normalizedName, cancellationToken);

        if (nameExists)
        {
            throw new DuplicateEntityException(StructureItem, "name", normalizedName);
        }

        DraftOrgUnit? parent = null;
        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            parent = await dbContext.DraftOrgUnits
                .FirstOrDefaultAsync(o => o.Id == request.ParentId.Value, cancellationToken);

            if (parent is null)
            {
                throw new EntityNotFoundException(ParentStructureItem, request.ParentId.Value);
            }
        }

        var draftOrgUnit = DraftOrgUnit.Create(
            tenantId,
            request.Code,
            request.Name,
            request.Type,
            request.ParentId);

        dbContext.DraftOrgUnits.Add(draftOrgUnit);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (DraftStructureRules.IsUniqueConstraintViolation(ex))
        {
            if (ex.InnerException?.Message.Contains("Code") == true)
            {
                throw new DuplicateEntityException(StructureItem, "code", normalizedCode);
            }

            throw new DuplicateEntityException(StructureItem, "name", normalizedName);
        }

        return Result.Success(DraftStructureMapper.ToDto(draftOrgUnit, parent?.Name));
    }
}