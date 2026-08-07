using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantAdministration;

/// <summary>Why a continuity command was refused.</summary>
public enum ContinuityFailure
{
    None = 0,

    /// <summary>Committing would have left the tenant with no usable administrator.</summary>
    FinalAdministrator,

    /// <summary>The caller acted on a version of the state that has since changed.</summary>
    StaleState,

    /// <summary>The membership, account, assignment, or tenant was not found.</summary>
    NotFound,

    /// <summary>The command does not apply to the current state.</summary>
    NotApplicable,

    /// <summary>The caller is not authorized for this tenant.</summary>
    NotAuthorized,
}

public sealed record ContinuityResult<T>(
    bool Succeeded,
    T? Value,
    ContinuityFailure Failure,
    string? Reason)
{
    public static ContinuityResult<T> Ok(T value) => new(true, value, ContinuityFailure.None, null);

    public static ContinuityResult<T> Refused(ContinuityFailure failure, string? reason = null)
        => new(false, default, failure, reason);
}

/// <summary>
/// The work a continuity command performs once it holds the tenant lock and has
/// re-read authoritative state.
/// </summary>
public sealed class TenantContinuityContext(
    AppIdentityDbContext dbContext,
    Guid tenantId,
    Guid? actorUserId)
{
    private readonly HashSet<Guid> _invalidatedMemberships = [];

    public AppIdentityDbContext Db { get; } = dbContext;

    public Guid TenantId { get; } = tenantId;

    public Guid? ActorUserId { get; } = actorUserId;

    internal IReadOnlyCollection<Guid> InvalidatedMemberships => _invalidatedMemberships;

    internal List<AccessAuditEvent> AuditEvents { get; } = [];

    /// <summary>
    /// Declares that this membership's current tenant access is no longer valid.
    /// The revision bump and the refresh-grant revocation happen inside the same
    /// commit as the mutation, so the next request carrying the old token fails
    /// closed rather than being served from a stale authority.
    /// </summary>
    public void InvalidateTenantAccess(TenantMembership membership)
    {
        ArgumentNullException.ThrowIfNull(membership);
        membership.BumpAccessRevision();
        _invalidatedMemberships.Add(membership.Id);
    }

    /// <summary>Records an access-administration event in this command's transaction.</summary>
    public void Audit(AccessAuditEvent auditEvent)
    {
        ArgumentNullException.ThrowIfNull(auditEvent);
        AuditEvents.Add(auditEvent);
    }
}

public interface ITenantContinuityCommandExecutor
{
    Task<ContinuityResult<T>> ExecuteAsync<T>(
        Guid tenantId,
        Guid? actorUserId,
        Func<TenantContinuityContext, Task<ContinuityResult<T>>> mutate,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// The single boundary through which every command that can change whether a
/// tenant still has a usable administrator must pass.
/// <para>
/// The rule this protects is a write-skew problem, not a row-level one: two
/// commands can each observe two usable administrators, each remove a different
/// one, and both commit correctly on their own rows — leaving zero. Versioning
/// the rows being changed cannot see that, because those rows are disjoint. So
/// every continuity command serializes on the tenant row itself.
/// </para>
/// <para>
/// Lock acquisition order is fixed once here for all commands: a command that
/// also needs an invitation row takes the invitation lock <em>first</em>, then
/// this tenant lock. No command chooses its own order, so no pair of commands can
/// deadlock against each other.
/// </para>
/// </summary>
public sealed class TenantContinuityCommandExecutor(AppIdentityDbContext dbContext)
    : ITenantContinuityCommandExecutor
{
    public async Task<ContinuityResult<T>> ExecuteAsync<T>(
        Guid tenantId,
        Guid? actorUserId,
        Func<TenantContinuityContext, Task<ContinuityResult<T>>> mutate,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(mutate);

        var relational = dbContext.Database.IsRelational();

        await using var transaction = relational
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        if (relational)
        {
            // Serialize every continuity-affecting command for this tenant. The
            // tenant row is the natural point: it already exists, every record
            // involved is tenant-qualified, and commands for different tenants
            // never contend.
            await dbContext.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM identity.\"Tenants\" WHERE \"Id\" = {0} FOR UPDATE",
                [tenantId],
                cancellationToken);
        }

        // Anything read before entering the executor is stale by definition.
        dbContext.ChangeTracker.Clear();

        // Read under the lock, before the mutation. The invariant is that no
        // command may be the one that leaves a tenant unadministered — not that
        // every command must end with an administrator. A tenant that already has
        // none is in the state Platform recovery exists to fix, and refusing the
        // fix because the count is still zero would make it unrecoverable.
        var usableBefore = await UsableTenantAdministrator.CountAsync(dbContext, tenantId, cancellationToken);

        var context = new TenantContinuityContext(dbContext, tenantId, actorUserId);
        var result = await mutate(context);

        if (!result.Succeeded)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return result;
        }

        // Recompute over the post-mutation state, not over what the caller saw.
        dbContext.ChangeTracker.DetectChanges();
        var remaining = await CountUsableAfterMutationAsync(tenantId, cancellationToken);

        if (usableBefore > 0 && remaining == 0)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            dbContext.ChangeTracker.Clear();
            await RecordBlockedAttemptAsync(tenantId, actorUserId, context, cancellationToken);

            return ContinuityResult<T>.Refused(
                ContinuityFailure.FinalAdministrator,
                "The tenant would be left without a usable Tenant Administrator.");
        }

        foreach (var auditEvent in context.AuditEvents)
        {
            dbContext.AccessAuditEvents.Add(auditEvent);
        }

        await RevokeRefreshGrantsAsync(context.InvalidatedMemberships, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return result;
    }

    /// <summary>
    /// Counts usable administrators including changes that are tracked but not yet
    /// saved, so the check reflects what committing would actually produce.
    /// </summary>
    private async Task<int> CountUsableAfterMutationAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
        return await UsableTenantAdministrator.CountAsync(dbContext, tenantId, cancellationToken);
    }

    /// <summary>
    /// A membership whose access was invalidated must not be able to trade an
    /// existing refresh token for a fresh access token; otherwise "immediate"
    /// would only mean "until the current token expires".
    /// </summary>
    private async Task RevokeRefreshGrantsAsync(
        IReadOnlyCollection<Guid> membershipIds,
        CancellationToken cancellationToken)
    {
        if (membershipIds.Count == 0)
        {
            return;
        }

        var userIds = await dbContext.TenantMemberships
            .IgnoreQueryFilters()
            .Where(membership => membershipIds.Contains(membership.Id))
            .Select(membership => membership.UserId)
            .ToListAsync(cancellationToken);

        var grants = await dbContext.RefreshTokens
            .Where(token => userIds.Contains(token.UserId) && token.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var grant in grants)
        {
            grant.RevokedAt = DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Written in its own short transaction after the refusal has rolled back.
    /// Committing it inside the refused command is not an option, and losing the
    /// evidence with the rollback would be the wrong trade: an attempt to remove a
    /// tenant's last administrator is exactly what an operator wants to see later.
    /// </summary>
    private async Task RecordBlockedAttemptAsync(
        Guid tenantId,
        Guid? actorUserId,
        TenantContinuityContext context,
        CancellationToken cancellationToken)
    {
        var blocked = context.AuditEvents.FirstOrDefault();

        dbContext.AccessAuditEvents.Add(AccessAuditEvent.Create(
            tenantId,
            actorUserId,
            blocked?.ActorName ?? string.Empty,
            blocked?.ActorRole ?? TenantAdministratorAuthority.DisplayName,
            AccessAuditActions.FinalAdministratorActionBlocked,
            blocked?.ResourceType ?? AccessAuditActions.ResourceTypeAdministrator,
            blocked?.ResourceId,
            "Action refused: the tenant would have been left without a usable Tenant Administrator.",
            beforeJson: null,
            afterJson: null,
            correlationId: blocked?.CorrelationId));

        await dbContext.SaveChangesAsync(cancellationToken);
        dbContext.ChangeTracker.Clear();
    }
}
