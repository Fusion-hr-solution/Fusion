using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftStructureWorkspace;

public sealed class GetDraftStructureWorkspaceQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetDraftStructureWorkspaceQuery, DraftStructureWorkspaceDto>
{
    public async Task<DraftStructureWorkspaceDto> Handle(
        GetDraftStructureWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var units = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);

        return DraftStructureMapper.ToWorkspace(units, schema);
    }
}