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
    public async Task<Result<DraftOrgUnitDto>> Handle(
        UpdateDraftOrgUnitCommand request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var draftOrgUnit = await dbContext.DraftOrgUnits
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (draftOrgUnit is null)
        {
            throw new EntityNotFoundException("DraftOrgUnit", request.Id);
        }

        if (draftOrgUnit.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("DraftOrgUnit", request.Id);
        }

        await DraftStructureRules.ValidateTypeAsync(dbContext, request.Type, cancellationToken);

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        if (!draftOrgUnit.Code.Equals(normalizedCode, StringComparison.Ordinal))
        {
            var codeExists = await dbContext.DraftOrgUnits
                .AnyAsync(o => o.Id != request.Id && o.Code == normalizedCode, cancellationToken);

            if (codeExists)
            {
                throw new DuplicateEntityException("DraftOrgUnit", "code", normalizedCode);
            }
        }

        var normalizedName = request.Name.Trim();
        if (!draftOrgUnit.Name.Equals(normalizedName, StringComparison.Ordinal))
        {
            var nameExists = await dbContext.DraftOrgUnits
                .AnyAsync(o => o.Id != request.Id && o.Name == normalizedName, cancellationToken);

            if (nameExists)
            {
                throw new DuplicateEntityException("DraftOrgUnit", "name", normalizedName);
            }
        }

        DraftOrgUnit? parent = null;
        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            if (request.ParentId.Value == request.Id)
            {
                throw new ArgumentException("Draft org unit cannot be its own parent.");
            }

            parent = await dbContext.DraftOrgUnits
                .FirstOrDefaultAsync(o => o.Id == request.ParentId.Value, cancellationToken);

            if (parent is null)
            {
                throw new EntityNotFoundException("Parent DraftOrgUnit", request.ParentId.Value);
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

        draftOrgUnit.Update(request.Code, request.Name, request.Type, request.ParentId);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("DraftOrgUnit", request.Id);
        }
        catch (DbUpdateException ex) when (DraftStructureRules.IsUniqueConstraintViolation(ex))
        {
            if (ex.InnerException?.Message.Contains("Code") == true)
            {
                throw new DuplicateEntityException("DraftOrgUnit", "code", normalizedCode);
            }

            throw new DuplicateEntityException("DraftOrgUnit", "name", normalizedName);
        }

        return Result.Success(DraftStructureMapper.ToDto(draftOrgUnit, parent?.Name));
    }
}