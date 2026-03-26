using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Queries.GetTenantSettings;

public sealed class GetTenantSettingsQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetTenantSettingsQuery, TenantSettingsDto>
{
    public async Task<TenantSettingsDto> Handle(
        GetTenantSettingsQuery request,
        CancellationToken cancellationToken)
    {
        // Query filtered by tenant via global query filter
        var settings = await dbContext.TenantSettings
            .FirstOrDefaultAsync(cancellationToken);

        // If no row exists, return defaults; otherwise merge overrides with defaults
        return TenantSettingsMerger.Merge(settings?.SettingsOverrides);
    }
}
