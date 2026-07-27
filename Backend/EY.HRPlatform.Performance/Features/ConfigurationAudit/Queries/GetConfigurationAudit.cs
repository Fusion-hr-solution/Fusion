using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ConfigurationAudit.Queries;

/// <summary>
/// One entry in the configuration change history, in product language rather than internal field
/// or enum names.
/// </summary>
public sealed record ConfigurationAuditEntryDto(
    Guid Id,
    string Scope,
    string Action,
    string EntityType,
    Guid EntityId,
    string? ActorName,
    DateTime OccurredAt,
    int? VersionNumber,
    string? PreviousValue,
    string? NewValue,
    string? Reason);

/// <summary>
/// Reads the configuration change history. Tenant administrators see their own tenant's entries;
/// platform entries are visible to platform administrators only.
/// </summary>
/// <remarks>
/// This trail has been written since the configuration work landed and read by nobody. The entity is
/// deliberately platform-scoped (no <c>ITenantEntity</c>, so no global query filter), which is why
/// this query applies the tenant predicate explicitly rather than relying on the filter.
/// </remarks>
public sealed record GetConfigurationAuditQuery(
    bool IncludePlatformScope,
    int? Page = null,
    int? PageSize = null)
    : IQuery<Result<PagedResponse<ConfigurationAuditEntryDto>>>;

public sealed class GetConfigurationAuditQueryHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext)
    : IQueryHandler<GetConfigurationAuditQuery, Result<PagedResponse<ConfigurationAuditEntryDto>>>
{
    public const string PlatformScope = "Platform";
    public const string TenantScope = "Tenant";

    public async Task<Result<PagedResponse<ConfigurationAuditEntryDto>>> Handle(
        GetConfigurationAuditQuery request,
        CancellationToken cancellationToken)
    {
        var page = HistoryPage.From(request.Page, request.PageSize);
        var tenantId = tenantContext.TenantIdOrDefault;

        var query = dbContext.PerformanceConfigurationAuditEntries.AsNoTracking();

        if (request.IncludePlatformScope)
        {
            // Platform administrators see platform-wide changes alongside the tenant's own.
            query = query.Where(entry =>
                entry.Scope == PlatformScope
                || (entry.Scope == TenantScope && entry.TenantId == tenantId));
        }
        else
        {
            // Fail closed: without a resolved tenant this matches nothing rather than everything.
            query = query.Where(entry => entry.Scope == TenantScope && entry.TenantId == tenantId);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var entries = await query
            // Id is the stable tiebreak so entries sharing a timestamp cannot reorder between pages.
            .OrderByDescending(entry => entry.OccurredAt)
            .ThenByDescending(entry => entry.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(entry => new ConfigurationAuditEntryDto(
                entry.Id,
                entry.Scope,
                entry.Action,
                entry.EntityType,
                entry.EntityId,
                entry.ActorName,
                entry.OccurredAt,
                entry.VersionNumber,
                entry.PreviousValue,
                entry.NewValue,
                entry.Reason))
            .ToListAsync(cancellationToken);

        return Result.Success(page.ToResponse(entries, totalCount));
    }
}
