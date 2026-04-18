using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetDraftSetupReadiness;

public sealed class GetDraftSetupReadinessQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetDraftSetupReadinessQuery, DraftSetupReadinessDto>
{
    public async Task<DraftSetupReadinessDto> Handle(
        GetDraftSetupReadinessQuery request,
        CancellationToken cancellationToken)
    {
        return await DraftStructureRules.EvaluateDraftReadinessAsync(dbContext, cancellationToken);
    }
}