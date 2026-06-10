using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetTenantSetupState;

public sealed class GetTenantSetupStateQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetTenantSetupStateQuery, TenantSetupStateDto>
{
    public async Task<TenantSetupStateDto> Handle(
        GetTenantSetupStateQuery request,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (state is null)
        {
            return TenantSetupStateMapper.Map(null, []);
        }

        var recentActivities = await dbContext.TenantSetupActivities
            .AsNoTracking()
            .Where(activity => activity.TenantSetupStateId == state.Id)
            .OrderByDescending(activity => activity.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        return await TenantSetupStateProjection.MapAsync(
            dbContext,
            state,
            recentActivities,
            cancellationToken);
    }
}