using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Features.Membership;

/// <summary>
/// The customer-workspace authority derived from exactly one Active tenant
/// membership. Its existence is the proof of that authority: there is no way to
/// construct one from a role, a header, or an account column.
/// </summary>
public sealed record CustomerContext(
    Guid TenantId,
    Guid MembershipId,
    IReadOnlyList<TenantModule> EnabledModules,
    int AccessRevision = 1)
{
    public bool HasModule(TenantModule module) => EnabledModules.Contains(module);
}

/// <summary>
/// Why no customer context was established. Distinguishing these keeps session
/// composition, diagnostics, and audit truthful instead of collapsing every case
/// into "no access".
/// </summary>
public enum CustomerContextDenial
{
    /// <summary>Account participates in no customer tenant. Normal for a Platform Administrator.</summary>
    NoActiveMembership = 0,

    /// <summary>
    /// More than one Active membership. Unsupported in this MVP, so the session
    /// fails closed rather than picking one or offering a selector.
    /// </summary>
    MultipleActiveMemberships = 1,

    /// <summary>Account holds the Platform Administrator role, which never carries customer authority.</summary>
    PlatformAdministrator = 2,
}

/// <summary>
/// Result of resolving customer authority for an account: either exactly one
/// context, or a reason there is none.
/// </summary>
public sealed record CustomerContextResult
{
    private CustomerContextResult() { }

    public CustomerContext? Context { get; private init; }

    public CustomerContextDenial? Denial { get; private init; }

    public bool IsAuthoritative => Context is not null;

    public static CustomerContextResult Authoritative(CustomerContext context)
        => new() { Context = context };

    public static CustomerContextResult Denied(CustomerContextDenial denial)
        => new() { Denial = denial };
}
