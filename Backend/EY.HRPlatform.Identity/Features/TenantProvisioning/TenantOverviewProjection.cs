using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

/// <summary>
/// The lifecycle position the Tenants workspace is scoped to. These are the
/// whole set: the overview answers "which tenants need me?", and the narrower
/// conditions belong to <see cref="TenantOverviewQuery"/>.
/// </summary>
public enum TenantOverviewFilter
{
    All = 0,
    AwaitingActivation = 1,
    Active = 2,
    NeedsAttention = 3,
}

/// <summary>
/// The orderings the list actually supports. Ordering is applied to the whole
/// matching set before paging, so page 2 continues page 1 rather than sorting
/// only what happens to be visible.
/// </summary>
public enum TenantOverviewSort
{
    CreatedDescending = 0,
    CreatedAscending = 1,
    NameAscending = 2,
    NameDescending = 3,
}

/// <summary>
/// Why a tenant is asking for platform action. Derived from the current
/// invitation and its latest delivery outcome — never stored, so the list cannot
/// claim a problem the tenant detail contradicts.
/// </summary>
public enum TenantAttentionReason
{
    None = 0,
    DeliveryFailed = 1,
    InvitationExpired = 2,
    InvitationRevoked = 3,
}

public sealed record TenantOverviewRowDto
{
    public Guid TenantId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string AdministratorActivationStatus { get; init; } = string.Empty;

    /// <summary>Nominated initial administrator, from the current bootstrap invitation.</summary>
    public string? InitialAdministratorEmail { get; init; }

    /// <summary>The current bootstrap invitation a row-level recovery would act on.</summary>
    public Guid? BootstrapInvitationId { get; init; }

    public string? InvitationState { get; init; }

    /// <summary>
    /// Recoveries this invitation's state actually permits, from the same rule
    /// the tenant detail uses. The row menu offers exactly these, so a shortcut
    /// can never present a control the service would refuse.
    /// </summary>
    public IReadOnlyList<string> AllowedActions { get; init; } = [];

    /// <summary>
    /// Outcome of the most recent delivery attempt for the current invitation.
    /// Separate from <see cref="InvitationState"/> on purpose: whether the
    /// message arrived says nothing about whether the invitation is still valid.
    /// </summary>
    public string? LastDeliveryOutcome { get; init; }

    public string AttentionReason { get; init; } = TenantAttentionReason.None.ToString();
    public bool NeedsAttention { get; init; }
    public IReadOnlyList<string> Modules { get; init; } = [];
    public DateTime CreatedAt { get; init; }
}

/// <summary>
/// The complete query the workspace is showing. One object so that the list,
/// the lifecycle counts and the export cannot drift apart.
/// </summary>
public sealed record TenantOverviewQuery
{
    public TenantOverviewFilter Filter { get; init; } = TenantOverviewFilter.All;
    public string? Search { get; init; }
    public IReadOnlyList<InvitationState> InvitationStates { get; init; } = [];
    public IReadOnlyList<InvitationDeliveryOutcome> DeliveryOutcomes { get; init; } = [];
    public IReadOnlyList<TenantModule> Modules { get; init; } = [];
    public DateOnly? CreatedFrom { get; init; }
    public DateOnly? CreatedTo { get; init; }
    public TenantOverviewSort Sort { get; init; } = TenantOverviewSort.CreatedDescending;
    public int Page { get; init; } = 1;

    /// <summary>Zero means every matching row, which is what an export needs.</summary>
    public int PageSize { get; init; } = 10;
}

/// <summary>
/// How many tenants sit in each lifecycle position for the current search and
/// advanced filters. Deliberately counted before the lifecycle filter is
/// applied, so selecting one card does not reduce the others to zero.
/// </summary>
public sealed record TenantOverviewCountsDto
{
    public int All { get; init; }
    public int AwaitingActivation { get; init; }
    public int Active { get; init; }
    public int NeedsAttention { get; init; }
}

public sealed record TenantOverviewPageDto
{
    public IReadOnlyList<TenantOverviewRowDto> Rows { get; init; } = [];

    /// <summary>Rows matching the complete query, not the number returned.</summary>
    public int TotalCount { get; init; }

    public int Page { get; init; }
    public int PageSize { get; init; }
    public TenantOverviewCountsDto Counts { get; init; } = new();
}

public interface ITenantOverviewProjection
{
    Task<TenantOverviewPageDto> GetAsync(
        TenantOverviewQuery query,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// The operational tenant list. Its job is retrieval, comparison, state scanning
/// and action discovery, so it returns the facts needed to decide whether a
/// tenant needs action — plus the lifecycle counts the workspace filters by, and
/// deliberately no invented metrics.
/// </summary>
public sealed class TenantOverviewProjection(AppIdentityDbContext dbContext) : ITenantOverviewProjection
{
    /// <summary>An upper bound on one response, so an export cannot become unbounded.</summary>
    public const int MaxPageSize = 1000;

    public async Task<TenantOverviewPageDto> GetAsync(
        TenantOverviewQuery query,
        CancellationToken cancellationToken = default)
    {
        var all = await BuildRowsAsync(cancellationToken);

        // Search and the advanced filters describe which tenants the operator is
        // looking at; the lifecycle filter only says which slice of those to
        // show. Counting between the two is what lets every card stay truthful
        // while one of them is selected.
        var scoped = ApplyAdvancedFilters(ApplySearch(all, query.Search), query).ToList();

        var counts = new TenantOverviewCountsDto
        {
            All = scoped.Count,
            AwaitingActivation = scoped.Count(IsAwaitingActivation),
            Active = scoped.Count(IsActive),
            NeedsAttention = scoped.Count(row => row.NeedsAttention),
        };

        var matching = ApplySort(ApplyFilter(scoped, query.Filter), query.Sort).ToList();

        var pageSize = query.PageSize <= 0
            ? MaxPageSize
            : Math.Min(query.PageSize, MaxPageSize);
        var page = Math.Max(1, query.Page);

        return new TenantOverviewPageDto
        {
            Rows = matching.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            TotalCount = matching.Count,
            Page = page,
            PageSize = pageSize,
            Counts = counts,
        };
    }

    private async Task<List<TenantOverviewRowDto>> BuildRowsAsync(CancellationToken cancellationToken)
    {
        var tenants = await dbContext.Tenants
            .AsNoTracking().IgnoreQueryFilters()
            .Select(tenant => new
            {
                tenant.Id,
                tenant.Name,
                tenant.AdministratorActivationStatus,
                tenant.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        var tenantIds = tenants.Select(tenant => tenant.Id).ToList();

        var entitlements = await dbContext.TenantModuleEntitlements
            .AsNoTracking().IgnoreQueryFilters()
            .Where(entitlement => tenantIds.Contains(entitlement.TenantId))
            .Select(entitlement => new { entitlement.TenantId, entitlement.Module })
            .ToListAsync(cancellationToken);

        var modulesByTenant = entitlements
            .GroupBy(entitlement => entitlement.TenantId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<string>)group
                    .Select(entitlement => entitlement.Module.ToString())
                    .OrderBy(module => module, StringComparer.Ordinal)
                    .ToList());

        // The current bootstrap invitation is the most recent one per tenant;
        // earlier invitations are lineage, not competing state.
        var invitations = await dbContext.InviteTokens
            .AsNoTracking().IgnoreQueryFilters()
            .Where(invitation => invitation.Purpose == InvitationPurpose.OrganizationBootstrap
                && tenantIds.Contains(invitation.TenantId))
            .OrderByDescending(invitation => invitation.CreatedAt)
            .ToListAsync(cancellationToken);

        var currentByTenant = invitations
            .GroupBy(invitation => invitation.TenantId)
            .ToDictionary(group => group.Key, group => group.First());

        var currentIds = currentByTenant.Values.Select(invitation => invitation.Id).ToList();

        var latestOutcomes = (await dbContext.InvitationDeliveryAttempts
                .AsNoTracking()
                .Where(attempt => currentIds.Contains(attempt.InvitationId))
                .ToListAsync(cancellationToken))
            .GroupBy(attempt => attempt.InvitationId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(attempt => attempt.AttemptedAt).First().Outcome);

        return tenants.Select(tenant =>
        {
            currentByTenant.TryGetValue(tenant.Id, out var invitation);

            var lastOutcome = invitation is not null
                && latestOutcomes.TryGetValue(invitation.Id, out var outcome)
                    ? outcome
                    : (InvitationDeliveryOutcome?)null;

            var attention = DeriveAttention(invitation?.State, lastOutcome);

            return new TenantOverviewRowDto
            {
                TenantId = tenant.Id,
                Name = tenant.Name,
                AdministratorActivationStatus = tenant.AdministratorActivationStatus.ToString(),
                InitialAdministratorEmail = invitation?.Email,
                BootstrapInvitationId = invitation?.Id,
                InvitationState = invitation?.State.ToString(),
                AllowedActions = invitation is null
                    ? []
                    : TenantDetailProjection.AllowedActionsFor(invitation.State),
                LastDeliveryOutcome = lastOutcome?.ToString(),
                AttentionReason = attention.ToString(),
                NeedsAttention = attention != TenantAttentionReason.None,
                Modules = modulesByTenant.TryGetValue(tenant.Id, out var modules) ? modules : [],
                CreatedAt = tenant.CreatedAt,
            };
        }).ToList();
    }

    /// <summary>
    /// Attention means a Platform Administrator has something to do. A Pending
    /// invitation that was delivered successfully is waiting on its recipient,
    /// not on the platform, so it is deliberately not an attention problem.
    /// </summary>
    public static TenantAttentionReason DeriveAttention(
        InvitationState? state,
        InvitationDeliveryOutcome? lastDeliveryOutcome)
    {
        if (state is null)
        {
            return TenantAttentionReason.None;
        }

        if (lastDeliveryOutcome == InvitationDeliveryOutcome.Failed
            && state is InvitationState.Pending)
        {
            return TenantAttentionReason.DeliveryFailed;
        }

        return state switch
        {
            InvitationState.Expired => TenantAttentionReason.InvitationExpired,

            // Revoked with no active replacement: the tenant has no live route in.
            // A revoked invitation that was already replaced reads as Superseded,
            // so reaching here means nothing superseded it.
            InvitationState.Revoked => TenantAttentionReason.InvitationRevoked,

            _ => TenantAttentionReason.None,
        };
    }

    private static bool IsAwaitingActivation(TenantOverviewRowDto row) =>
        row.AdministratorActivationStatus
            == TenantAdministratorActivationStatus.AwaitingAdministratorActivation.ToString();

    private static bool IsActive(TenantOverviewRowDto row) =>
        row.AdministratorActivationStatus
            == TenantAdministratorActivationStatus.Active.ToString();

    private static IEnumerable<TenantOverviewRowDto> ApplyFilter(
        IEnumerable<TenantOverviewRowDto> rows,
        TenantOverviewFilter filter) => filter switch
        {
            TenantOverviewFilter.AwaitingActivation => rows.Where(IsAwaitingActivation),
            TenantOverviewFilter.Active => rows.Where(IsActive),
            TenantOverviewFilter.NeedsAttention => rows.Where(row => row.NeedsAttention),
            _ => rows,
        };

    /// <summary>
    /// Each selected dimension narrows the result; values within one dimension
    /// widen it. Two invitation states means "either"; an invitation state and a
    /// module means "both".
    /// </summary>
    private static IEnumerable<TenantOverviewRowDto> ApplyAdvancedFilters(
        IEnumerable<TenantOverviewRowDto> rows,
        TenantOverviewQuery query)
    {
        if (query.InvitationStates.Count > 0)
        {
            var wanted = query.InvitationStates
                .Select(state => state.ToString()).ToHashSet(StringComparer.Ordinal);
            rows = rows.Where(row =>
                row.InvitationState is not null && wanted.Contains(row.InvitationState));
        }

        if (query.DeliveryOutcomes.Count > 0)
        {
            var wanted = query.DeliveryOutcomes
                .Select(outcome => outcome.ToString()).ToHashSet(StringComparer.Ordinal);
            rows = rows.Where(row =>
                row.LastDeliveryOutcome is not null && wanted.Contains(row.LastDeliveryOutcome));
        }

        if (query.Modules.Count > 0)
        {
            var wanted = query.Modules
                .Select(module => module.ToString()).ToHashSet(StringComparer.Ordinal);
            rows = rows.Where(row => row.Modules.Any(wanted.Contains));
        }

        if (query.CreatedFrom is { } from)
        {
            rows = rows.Where(row => DateOnly.FromDateTime(row.CreatedAt) >= from);
        }

        if (query.CreatedTo is { } to)
        {
            // Inclusive: an operator entering today's date means "up to and
            // including today", not "up to midnight this morning".
            rows = rows.Where(row => DateOnly.FromDateTime(row.CreatedAt) <= to);
        }

        return rows;
    }

    private static IEnumerable<TenantOverviewRowDto> ApplySort(
        IEnumerable<TenantOverviewRowDto> rows,
        TenantOverviewSort sort) => sort switch
        {
            TenantOverviewSort.CreatedAscending => rows.OrderBy(row => row.CreatedAt),
            TenantOverviewSort.NameAscending =>
                rows.OrderBy(row => row.Name, StringComparer.OrdinalIgnoreCase),
            TenantOverviewSort.NameDescending =>
                rows.OrderByDescending(row => row.Name, StringComparer.OrdinalIgnoreCase),

            // Newest first: the tenant just provisioned is the one most likely to
            // still need attention.
            _ => rows.OrderByDescending(row => row.CreatedAt),
        };

    private static List<TenantOverviewRowDto> ApplySearch(
        List<TenantOverviewRowDto> rows,
        string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return rows;
        }

        // Tenant name and nominated administrator are what an operator actually
        // remembers when looking for a record.
        var term = search.Trim();
        return rows.Where(row =>
            row.Name.Contains(term, StringComparison.OrdinalIgnoreCase)
            || (row.InitialAdministratorEmail?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false))
            .ToList();
    }
}
