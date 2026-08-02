using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public sealed record TenantDetailDto
{
    public Guid TenantId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string AdministratorActivationStatus { get; init; } = string.Empty;
    public string Locale { get; init; } = string.Empty;
    public string TimeZone { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public IReadOnlyList<string> Modules { get; init; } = [];
    public BootstrapInvitationSummaryDto? BootstrapInvitation { get; init; }
    public IReadOnlyList<TenantBootstrapHistoryEntryDto> History { get; init; } = [];
}

public sealed record BootstrapInvitationSummaryDto
{
    public Guid InvitationId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }

    /// <summary>Outcome of the most recent completed delivery request, if any.</summary>
    public DeliveryAttemptSummaryDto? LastDelivery { get; init; }

    /// <summary>
    /// Actions the current state actually permits. The UI offers exactly these,
    /// so it cannot present a control the backend would refuse.
    /// </summary>
    public IReadOnlyList<string> AllowedActions { get; init; } = [];
}

public sealed record DeliveryAttemptSummaryDto
{
    public string Outcome { get; init; } = string.Empty;
    public DateTime AttemptedAt { get; init; }
    public string? FailureCode { get; init; }
}

public sealed record TenantBootstrapHistoryEntryDto
{
    public string EventType { get; init; } = string.Empty;
    public DateTime OccurredAt { get; init; }
    public string Outcome { get; init; } = string.Empty;
    public string? Reason { get; init; }

    /// <summary>
    /// Who caused it, already resolved to a display name. Null means the
    /// platform itself acted, which the interface states in words rather than
    /// leaving blank. An account identifier is not a person, so it never leaves
    /// the service.
    /// </summary>
    public string? ActorName { get; init; }
}

public interface ITenantDetailProjection
{
    Task<TenantDetailDto?> GetAsync(Guid tenantId, CancellationToken cancellationToken = default);
}

/// <summary>
/// The authoritative Platform view of one tenant's bootstrap state. It carries no
/// credential material and offers no customer-workspace entry.
/// </summary>
public sealed class TenantDetailProjection(AppIdentityDbContext dbContext) : ITenantDetailProjection
{
    /// <summary>History is bounded so the page cannot degrade on a noisy tenant.</summary>
    private const int HistoryLimit = 50;

    public async Task<TenantDetailDto?> GetAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await dbContext.Tenants
            .AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return null;
        }

        var modules = await dbContext.TenantModuleEntitlements
            .AsNoTracking().IgnoreQueryFilters()
            .Where(entitlement => entitlement.TenantId == tenantId)
            .OrderBy(entitlement => entitlement.Module)
            .Select(entitlement => entitlement.Module.ToString())
            .ToListAsync(cancellationToken);

        // The current bootstrap invitation is the most recent one; earlier ones
        // are explained by history rather than shown as competing state.
        var invitation = await dbContext.InviteTokens
            .AsNoTracking().IgnoreQueryFilters()
            .Where(item => item.TenantId == tenantId
                && item.Purpose == InvitationPurpose.OrganizationBootstrap)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        BootstrapInvitationSummaryDto? invitationSummary = null;
        if (invitation is not null)
        {
            var lastAttempt = await dbContext.InvitationDeliveryAttempts
                .AsNoTracking()
                .Where(attempt => attempt.InvitationId == invitation.Id)
                .OrderByDescending(attempt => attempt.AttemptedAt)
                .Select(attempt => new DeliveryAttemptSummaryDto
                {
                    Outcome = attempt.Outcome.ToString(),
                    AttemptedAt = attempt.AttemptedAt,
                    FailureCode = attempt.SanitizedFailureCode,
                })
                .FirstOrDefaultAsync(cancellationToken);

            invitationSummary = new BootstrapInvitationSummaryDto
            {
                InvitationId = invitation.Id,
                Email = invitation.Email,
                State = invitation.State.ToString(),
                ExpiresAt = invitation.ExpiresAt,
                CreatedAt = invitation.CreatedAt,
                LastDelivery = lastAttempt,
                AllowedActions = AllowedActionsFor(invitation.State),
            };
        }

        var events = await dbContext.TenantBootstrapAuditEvents
            .AsNoTracking().IgnoreQueryFilters()
            .Where(auditEvent => auditEvent.TenantId == tenantId)
            .OrderByDescending(auditEvent => auditEvent.OccurredAt)
            .Take(HistoryLimit)
            .Select(auditEvent => new
            {
                auditEvent.EventType,
                auditEvent.OccurredAt,
                auditEvent.Outcome,
                auditEvent.Reason,
                auditEvent.ActorAccountId,
            })
            .ToListAsync(cancellationToken);

        var actorIds = events
            .Where(entry => entry.ActorAccountId.HasValue)
            .Select(entry => entry.ActorAccountId!.Value)
            .Distinct()
            .ToList();

        // Resolved here rather than in the interface: the timeline shows people,
        // and an account identifier is not a person.
        var actorNames = await dbContext.Users
            .AsNoTracking().IgnoreQueryFilters()
            .Where(user => actorIds.Contains(user.Id))
            .Select(user => new { user.Id, user.FirstName, user.LastName })
            .ToDictionaryAsync(
                user => user.Id,
                user => $"{user.FirstName} {user.LastName}".Trim(),
                cancellationToken);

        var history = events.Select(entry => new TenantBootstrapHistoryEntryDto
        {
            EventType = entry.EventType.ToString(),
            OccurredAt = entry.OccurredAt,
            Outcome = entry.Outcome,
            Reason = entry.Reason,
            ActorName = entry.ActorAccountId is { } actorId
                && actorNames.TryGetValue(actorId, out var actorName)
                && !string.IsNullOrWhiteSpace(actorName)
                    ? actorName
                    : null,
        }).ToList();

        return new TenantDetailDto
        {
            TenantId = tenant.Id,
            Name = tenant.Name,
            Slug = tenant.Slug,
            AdministratorActivationStatus = tenant.AdministratorActivationStatus.ToString(),
            Locale = tenant.Locale,
            TimeZone = tenant.TimeZone,
            CreatedAt = tenant.CreatedAt,
            Modules = modules,
            BootstrapInvitation = invitationSummary,
            History = history,
        };
    }

    /// <summary>
    /// Mirrors the recovery service preconditions exactly. Accepted and Superseded
    /// invitations offer nothing, because nothing can be done to them.
    /// </summary>
    public static IReadOnlyList<string> AllowedActionsFor(InvitationState state) => state switch
    {
        InvitationState.Pending => ["resend", "revoke", "replace"],
        // Nominating a different administrator is also how a tenant whose
        // invitation lapsed is handed to someone else, so replacement stays
        // available alongside reissue.
        InvitationState.Expired or InvitationState.Revoked => ["reissue", "replace"],
        _ => [],
    };
}
