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
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);

        var tenantId = tenantContext.TenantId;
        var normalizedReferenceKey = DraftStructureRules.NormalizeReferenceKey(request.ReferenceKey);

        await DraftStructureRules.ValidateOrgUnitKindAsync(dbContext, request.OrgUnitKindKey, cancellationToken);

        var attributesJson = await DraftStructureRules.ValidateAndNormalizeAttributesAsync(
            dbContext,
            request.OrgUnitKindKey,
            request.Attributes,
            cancellationToken);

        var referenceKeyExists = await dbContext.DraftOrgUnits
            .AnyAsync(o => o.NormalizedReferenceKey == normalizedReferenceKey, cancellationToken);

        if (referenceKeyExists)
        {
            throw new DuplicateEntityException(StructureItem, "referenceKey", request.ReferenceKey.Trim());
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
            request.ReferenceKey,
            request.DisplayName,
            request.OrgUnitKindKey,
            request.BusinessCode,
            request.Description,
            attributesJson,
            request.ParentId);

        dbContext.DraftOrgUnits.Add(draftOrgUnit);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (DraftStructureRules.IsUniqueConstraintViolation(ex))
        {
            throw new DuplicateEntityException(StructureItem, "referenceKey", request.ReferenceKey.Trim());
        }

        return Result.Success(DraftStructureMapper.ToDto(draftOrgUnit, schema, parent));
    }
}