using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitById;

public sealed class GetDraftOrgUnitByIdQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetDraftOrgUnitByIdQuery, DraftOrgUnitDto>
{
    private const string StructureItem = "Structure item";

    public async Task<DraftOrgUnitDto> Handle(
        GetDraftOrgUnitByIdQuery request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);

        var draftOrgUnit = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (draftOrgUnit is null)
        {
            throw new EntityNotFoundException(StructureItem, request.Id);
        }

        DraftOrgUnit? parent = null;
        if (draftOrgUnit.ParentId.HasValue)
        {
            parent = await dbContext.DraftOrgUnits
                .Where(o => o.Id == draftOrgUnit.ParentId.Value)
                .Select(o => o)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return DraftStructureMapper.ToDto(draftOrgUnit, schema, parent);
    }
}