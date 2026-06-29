using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.UpdateDraftOrgUnit;

public sealed class UpdateDraftOrgUnitCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<UpdateDraftOrgUnitCommand, Result<DraftOrgUnitDto>>
{
    private const string StructureItem = "Structure item";
    private const string ParentStructureItem = "Parent structure item";

    public async Task<Result<DraftOrgUnitDto>> Handle(
        UpdateDraftOrgUnitCommand request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureDraftEditableAsync(dbContext, cancellationToken);
        var setupState = await dbContext.TenantSetupStates.FirstAsync(cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);

        var draftOrgUnit = await dbContext.DraftOrgUnits
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (draftOrgUnit is null)
        {
            throw new EntityNotFoundException(StructureItem, request.Id);
        }

        if (draftOrgUnit.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException(StructureItem, request.Id);
        }

        await DraftStructureRules.ValidateOrgUnitKindAsync(dbContext, request.OrgUnitKindKey, cancellationToken);

        var normalizedReferenceKey = DraftStructureRules.NormalizeReferenceKey(request.ReferenceKey);
        if (!draftOrgUnit.NormalizedReferenceKey.Equals(normalizedReferenceKey, StringComparison.Ordinal))
        {
            var referenceKeyExists = await dbContext.DraftOrgUnits
                .AnyAsync(o => o.Id != request.Id && o.NormalizedReferenceKey == normalizedReferenceKey, cancellationToken);

            if (referenceKeyExists)
            {
                throw new DuplicateEntityException(StructureItem, "referenceKey", request.ReferenceKey.Trim());
            }
        }

        var attributesJson = request.Attributes is null
            ? draftOrgUnit.AttributesJson
            : await DraftStructureRules.ValidateAndNormalizeAttributesAsync(
                dbContext,
                request.OrgUnitKindKey,
                request.Attributes,
                cancellationToken);

        DraftOrgUnit? parent = null;
        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            if (request.ParentId.Value == request.Id)
            {
                throw new ArgumentException("A structure item cannot be its own parent.");
            }

            parent = await dbContext.DraftOrgUnits
                .FirstOrDefaultAsync(o => o.Id == request.ParentId.Value, cancellationToken);

            if (parent is null)
            {
                throw new EntityNotFoundException(ParentStructureItem, request.ParentId.Value);
            }

            if (await DraftStructureRules.WouldCreateCycleAsync(
                    dbContext,
                    request.Id,
                    request.ParentId.Value,
                    cancellationToken))
            {
                throw new ArgumentException(
                    "Cannot assign this parent as it would create a cycle in the draft hierarchy.");
            }
        }

        draftOrgUnit.Update(
            request.ReferenceKey,
            request.DisplayName,
            request.OrgUnitKindKey,
            request.Location,
            request.Description,
            attributesJson,
            request.ParentId);

        if (request.ActorUserId.HasValue
            && !string.IsNullOrWhiteSpace(request.ActorFullName)
            && !string.IsNullOrWhiteSpace(request.ActorRole))
        {
            dbContext.TenantSetupActivities.Add(
                TenantSetupActivity.Create(
                    setupState.TenantId,
                    setupState.Id,
                    TenantSetupActivityType.DraftUpdated,
                    request.ActorUserId.Value,
                    request.ActorFullName,
                    request.ActorRole,
                    request.IsPlatformAssisted));
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(StructureItem, request.Id);
        }
        catch (DbUpdateException ex) when (DraftStructureRules.IsUniqueConstraintViolation(ex))
        {
            throw new DuplicateEntityException(StructureItem, "referenceKey", request.ReferenceKey.Trim());
        }

        return Result.Success(DraftStructureMapper.ToDto(draftOrgUnit, schema, parent));
    }
}
