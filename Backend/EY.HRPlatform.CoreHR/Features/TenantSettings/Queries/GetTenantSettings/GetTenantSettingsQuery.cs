using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Queries.GetTenantSettings;

/// <summary>
/// Query to retrieve tenant settings for the current tenant.
/// Tenant ID is resolved from the request context.
/// </summary>
public sealed record GetTenantSettingsQuery : IQuery<TenantSettingsDto>;
