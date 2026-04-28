using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Services;

public interface ITenantSettingsReadService
{
    Task<TenantSettingsDto> GetCurrentAsync(CancellationToken cancellationToken);
}

public sealed class TenantSettingsReadService(CoreHRDbContext dbContext) : ITenantSettingsReadService
{
    public async Task<TenantSettingsDto> GetCurrentAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);
    }
}