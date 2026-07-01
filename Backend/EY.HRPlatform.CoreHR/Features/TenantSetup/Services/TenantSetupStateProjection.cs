using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Services;

public static class TenantSetupStateProjection
{
    public static async Task<TenantSetupStateDto> MapAsync(
        CoreHRDbContext dbContext,
        TenantSetupState? state,
        IReadOnlyCollection<TenantSetupActivity>? recentActivities,
        CancellationToken cancellationToken)
    {
        var hasDraftStructure = state is not null
            && state.CurrentPhase != TenantSetupPhase.NotStarted
            && await dbContext.DraftOrgUnits.AsNoTracking().AnyAsync(cancellationToken);

        return TenantSetupStateMapper.Map(state, recentActivities, hasDraftStructure);
    }
}