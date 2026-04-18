using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.DeleteDraftOrgUnit;

public sealed class DeleteDraftOrgUnitCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<DeleteDraftOrgUnitCommand, Result>
{
    private const string StructureItem = "Structure item";
    private const string ReplacementParent = "Replacement parent structure item";

    public async Task<Result> Handle(
        DeleteDraftOrgUnitCommand request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureDraftEditableAsync(dbContext, cancellationToken);

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

        var children = await dbContext.DraftOrgUnits
            .Where(o => o.ParentId == request.Id)
            .ToListAsync(cancellationToken);

        if (request.ReplacementParentId.HasValue && request.PromoteChildrenToRoot)
        {
            throw new ArgumentException(
                "Choose either a replacement parent or promote children to root, not both.");
        }

        if (children.Count > 0)
        {
            if (!request.ReplacementParentId.HasValue && !request.PromoteChildrenToRoot)
            {
                throw new ArgumentException(
                    "Deleting a structure item with children requires a replacement parent or promotion to root.");
            }

            if (request.ReplacementParentId == request.Id)
            {
                throw new ArgumentException("Replacement parent cannot be the structure item being deleted.");
            }

            if (request.ReplacementParentId.HasValue)
            {
                var replacementParent = await dbContext.DraftOrgUnits
                    .FirstOrDefaultAsync(o => o.Id == request.ReplacementParentId.Value, cancellationToken);

                if (replacementParent is null)
                {
                    throw new EntityNotFoundException(ReplacementParent, request.ReplacementParentId.Value);
                }

                foreach (var child in children)
                {
                    if (await DraftStructureRules.WouldCreateCycleAsync(
                            dbContext,
                            child.Id,
                            request.ReplacementParentId.Value,
                            cancellationToken))
                    {
                        throw new ArgumentException(
                            "Cannot reparent children to the selected structure item because it would create a cycle.");
                    }
                }
            }

            foreach (var child in children)
            {
                child.Reparent(request.PromoteChildrenToRoot ? null : request.ReplacementParentId);
            }
        }

        dbContext.DraftOrgUnits.Remove(draftOrgUnit);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(StructureItem, request.Id);
        }

        return Result.Success();
    }
}