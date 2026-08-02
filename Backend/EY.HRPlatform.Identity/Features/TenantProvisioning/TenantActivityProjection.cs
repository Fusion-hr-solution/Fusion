using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

/// <summary>
/// One recent bootstrap event, across every customer tenant.
///
/// It carries what a Platform Administrator needs to recognise what happened and
/// open the tenant it happened to — and nothing else. No correlation identifier,
/// no invitation identifier, no stored metadata, no invited address: those are
/// investigation detail belonging to the tenant's own record, and an overview
/// feed is the wrong place to widen exposure.
/// </summary>
public sealed record TenantActivityEntryDto
{
    public string EventType { get; init; } = string.Empty;
    public Guid TenantId { get; init; }
    public string TenantName { get; init; } = string.Empty;
    public DateTime OccurredAt { get; init; }

    /// <summary>Bounded outcome label. Separates a sent invitation from a bounced one.</summary>
    public string Outcome { get; init; } = string.Empty;

    /// <summary>
    /// Who caused it, already resolved to a display name. Null means the platform
    /// itself acted, which the interface states in words rather than leaving blank.
    /// </summary>
    public string? ActorName { get; init; }
}

public interface ITenantActivityProjection
{
    Task<IReadOnlyList<TenantActivityEntryDto>> GetRecentAsync(
        int limit,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// The most recent bootstrap activity across tenants.
///
/// This is the read the Tenants workspace previews and a full audit page would
/// later page through, so the shape is deliberately the durable one: bounded,
/// newest first, and already resolved to display names. It reads the same
/// bootstrap audit records the tenant detail shows, so the two can never
/// disagree about what happened.
/// </summary>
public sealed class TenantActivityProjection(AppIdentityDbContext dbContext) : ITenantActivityProjection
{
    /// <summary>An overview preview, not a log viewer. Bounded so it cannot degrade.</summary>
    public const int MaxLimit = 25;
    public const int DefaultLimit = 6;

    public async Task<IReadOnlyList<TenantActivityEntryDto>> GetRecentAsync(
        int limit,
        CancellationToken cancellationToken = default)
    {
        var take = Math.Clamp(limit <= 0 ? DefaultLimit : limit, 1, MaxLimit);

        var events = await dbContext.TenantBootstrapAuditEvents
            .AsNoTracking().IgnoreQueryFilters()
            .OrderByDescending(auditEvent => auditEvent.OccurredAt)
            .Take(take)
            .Select(auditEvent => new
            {
                auditEvent.EventType,
                auditEvent.TenantId,
                auditEvent.OccurredAt,
                auditEvent.Outcome,
                auditEvent.ActorAccountId,
            })
            .ToListAsync(cancellationToken);

        if (events.Count == 0)
        {
            return [];
        }

        var tenantIds = events.Select(entry => entry.TenantId).Distinct().ToList();

        var tenantNames = await dbContext.Tenants
            .AsNoTracking().IgnoreQueryFilters()
            .Where(tenant => tenantIds.Contains(tenant.Id))
            .Select(tenant => new { tenant.Id, tenant.Name })
            .ToDictionaryAsync(tenant => tenant.Id, tenant => tenant.Name, cancellationToken);

        var actorIds = events
            .Where(entry => entry.ActorAccountId.HasValue)
            .Select(entry => entry.ActorAccountId!.Value)
            .Distinct()
            .ToList();

        // Resolved here rather than in the interface: the feed shows people, and
        // an account identifier is not a person.
        var actorNames = await dbContext.Users
            .AsNoTracking().IgnoreQueryFilters()
            .Where(user => actorIds.Contains(user.Id))
            .Select(user => new { user.Id, user.FirstName, user.LastName })
            .ToDictionaryAsync(
                user => user.Id,
                user => $"{user.FirstName} {user.LastName}".Trim(),
                cancellationToken);

        return events.Select(entry => new TenantActivityEntryDto
        {
            EventType = entry.EventType.ToString(),
            TenantId = entry.TenantId,
            // A deleted or unreadable tenant still produced a real event; the
            // entry stays rather than vanishing from the history.
            TenantName = tenantNames.TryGetValue(entry.TenantId, out var name)
                ? name
                : "Unknown tenant",
            OccurredAt = entry.OccurredAt,
            Outcome = entry.Outcome,
            ActorName = entry.ActorAccountId is { } actorId
                && actorNames.TryGetValue(actorId, out var actorName)
                && !string.IsNullOrWhiteSpace(actorName)
                    ? actorName
                    : null,
        }).ToList();
    }
}
