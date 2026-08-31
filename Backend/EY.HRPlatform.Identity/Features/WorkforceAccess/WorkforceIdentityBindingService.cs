using System.Text.Json;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.WorkforceAccess;

/// <summary>Outcome of an authoritative workforce binding commit.</summary>
public enum WorkforceBindingResultStatus
{
    /// <summary>The membership is now bound to the Employee with the reviewed baseline.</summary>
    Bound,

    /// <summary>The membership no longer exists (or is not in this tenant) under the lock.</summary>
    MembershipNotFound,

    /// <summary>Another membership in this tenant already binds this Employee.</summary>
    EmployeeAlreadyBoundInTenant,

    /// <summary>This membership already binds a different Employee; correction must clear it first.</summary>
    AlreadyBoundToDifferentEmployee,

    /// <summary>
    /// Connect found that the account already has a membership in this tenant under the
    /// lock. The caller must re-resolve — the truthful state is now link/reactivate/active,
    /// not join — rather than create a duplicate membership.
    /// </summary>
    MembershipAlreadyExists,
}

/// <summary>
/// A trusted, already-resolved workforce subject ready to bind. Callers MUST have
/// re-resolved the canonical Employee (existence, tenant ownership, work email) through
/// the trusted CoreHR boundary before constructing this; the service does not accept
/// browser-supplied Employee facts. A candidate preview returned earlier is not authority
/// here — the service re-reads and rechecks membership state under the tenant lock.
/// </summary>
public sealed record WorkforceBindingCommand(
    Guid TenantId,
    Guid MembershipId,
    Guid EmployeeId,
    WorkforceBaseline Baseline,
    Guid? ActingUserId,
    string ActorName,
    string ActorRole,
    string AuditAction,
    string AuditSummary,
    string? CorrelationId = null,
    bool ReactivateSuspendedMembership = false);

public sealed record WorkforceBindingResult(
    WorkforceBindingResultStatus Status,
    Guid? MembershipId,
    Guid? EmployeeId,
    int? AccessRevision)
{
    public bool Succeeded => Status == WorkforceBindingResultStatus.Bound;
}

/// <summary>
/// A trusted, already-resolved workforce subject whose global account has no membership
/// in this tenant, ready to join it. The service creates exactly one Active membership
/// for <see cref="UserId"/> under the tenant lock and binds it, or — if a membership
/// now exists — refuses with <see cref="WorkforceBindingResultStatus.MembershipAlreadyExists"/>
/// so the caller re-resolves rather than duplicating. As with binding, the caller MUST
/// have re-resolved the canonical Employee and account through the trusted CoreHR boundary.
/// </summary>
public sealed record WorkforceConnectCommand(
    Guid TenantId,
    Guid UserId,
    Guid EmployeeId,
    WorkforceBaseline Baseline,
    Guid? ActingUserId,
    string ActorName,
    string ActorRole,
    string AuditAction,
    string AuditSummary,
    string? CorrelationId = null);

/// <summary>The typed, non-disclosing outcome of a single-person identity correction.</summary>
public enum WorkforceCorrectionStatus
{
    /// <summary>The membership was rebound from the source Employee to the target Employee.</summary>
    Corrected,

    /// <summary>No membership in this tenant is bound to the source Employee any more; re-resolve.</summary>
    SourceNotBound,

    /// <summary>The account changed since it was reviewed (revision moved); re-resolve.</summary>
    ConcurrencyMismatch,

    /// <summary>The target Employee is already bound to another account in this tenant.</summary>
    TargetAlreadyBound,

    /// <summary>Source and target are the same Employee; nothing to correct.</summary>
    SameEmployee,
}

/// <summary>
/// A trusted, already-resolved correction request. CoreHR has re-resolved BOTH the
/// currently-bound source Employee and the corrected target Employee (existence, tenant
/// ownership) through the trusted boundary before this reaches Identity; the browser
/// supplies neither identity fact, only references, the reviewed baseline, a required
/// reason, and the access-revision it reviewed. Single person only: no account deletion,
/// no recreation, and no bulk correction is expressible.
/// </summary>
public sealed record WorkforceCorrectionCommand(
    Guid TenantId,
    Guid SourceEmployeeId,
    Guid TargetEmployeeId,
    WorkforceBaseline Baseline,
    string Reason,
    int ExpectedRevision,
    Guid? ActingUserId,
    string ActorName,
    string ActorRole,
    string? CorrelationId = null);

public sealed record WorkforceCorrectionResult(
    WorkforceCorrectionStatus Status,
    Guid? MembershipId,
    int? AccessRevision)
{
    public bool Succeeded => Status == WorkforceCorrectionStatus.Corrected;
}

public interface IWorkforceIdentityBindingService
{
    /// <summary>
    /// Corrects one account's Employee binding as a single atomic transaction: under the
    /// tenant lock it finds the membership currently bound to the source Employee, verifies
    /// the reviewed revision still matches, clears that binding, rebinds it to the target
    /// Employee, applies the reviewed baseline additively (preserving HR Admin, Org Admin,
    /// custom, and Tenant Administrator authority), revokes any now-obsolete pending
    /// invitation for the source, bumps the access revision (with refresh-grant revocation),
    /// and writes the append-only before/after audit with the required reason. The account
    /// itself is never deleted or recreated; a stale or conflicting request fails closed
    /// with a typed, non-disclosing outcome.
    /// </summary>
    Task<WorkforceCorrectionResult> CorrectAsync(
        WorkforceCorrectionCommand command,
        CancellationToken cancellationToken);

    /// <summary>
    /// Commits a reviewed workforce binding as one atomic Identity transaction:
    /// membership Employee binding, additive workforce baseline, optional membership
    /// reactivation, caller-supplied pending-invitation reconciliation, access-revision
    /// bump (with refresh-grant revocation), and the append-only access-audit event.
    /// Either all of it commits or none of it does — a failure leaves no partial identity
    /// state. State is re-read and rechecked under the tenant lock, so a stale candidate
    /// decision cannot drive the commit, and the <c>(TenantId, EmployeeId)</c> database
    /// constraint remains the final guard against a concurrent duplicate binding.
    /// </summary>
    Task<WorkforceBindingResult> BindAsync(
        WorkforceBindingCommand command,
        Func<TenantContinuityContext, TenantMembership, Task>? reconcileInvitation,
        CancellationToken cancellationToken);

    /// <summary>
    /// Connects an existing global account into this tenant: creates one Active
    /// membership under the tenant lock and binds it to the Employee with the reviewed
    /// baseline, in the same atomic transaction as the binding, baseline, revision bump,
    /// and audit. Refuses to create a duplicate if a membership already exists here.
    /// </summary>
    Task<WorkforceBindingResult> ConnectAndBindAsync(
        WorkforceConnectCommand command,
        Func<TenantContinuityContext, TenantMembership, Task>? reconcileInvitation,
        CancellationToken cancellationToken);
}

public sealed class WorkforceIdentityBindingService(
    ITenantContinuityCommandExecutor continuity,
    IWorkforceBaselineService baselineService) : IWorkforceIdentityBindingService
{
    public async Task<WorkforceBindingResult> BindAsync(
        WorkforceBindingCommand command,
        Func<TenantContinuityContext, TenantMembership, Task>? reconcileInvitation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (command.TenantId == Guid.Empty)
            throw new ArgumentException("A resolved tenant is required.", nameof(command));
        if (command.EmployeeId == Guid.Empty)
            throw new ArgumentException("A resolved Employee is required.", nameof(command));

        var result = await continuity.ExecuteAsync<WorkforceBindingResult>(
            command.TenantId,
            command.ActingUserId,
            async context =>
            {
                // Re-read under the lock. Anything the caller previewed is stale by
                // definition; the authority is what the row says now.
                var membership = await context.Db.TenantMemberships
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        m => m.Id == command.MembershipId && m.TenantId == command.TenantId,
                        cancellationToken);

                if (membership is null)
                {
                    return ContinuityResult<WorkforceBindingResult>.Ok(
                        new WorkforceBindingResult(WorkforceBindingResultStatus.MembershipNotFound, null, null, null));
                }

                if (membership.EmployeeId is { } boundEmployeeId && boundEmployeeId != command.EmployeeId)
                {
                    // Rebinding to a different Employee is correction, a separate path
                    // that clears the binding first. Refuse rather than silently rebind.
                    return ContinuityResult<WorkforceBindingResult>.Ok(
                        new WorkforceBindingResult(
                            WorkforceBindingResultStatus.AlreadyBoundToDifferentEmployee,
                            membership.Id, boundEmployeeId, membership.AccessRevision));
                }

                if (command.ReactivateSuspendedMembership
                    && membership.Status == TenantMembershipStatus.Suspended)
                {
                    membership.Reactivate(command.ActingUserId);
                }

                return await CommitBindingAsync(
                    context, membership, command.EmployeeId, command.Baseline, command.ActingUserId,
                    command.ActorName, command.ActorRole, command.AuditAction, command.AuditSummary,
                    command.CorrelationId, reconcileInvitation, cancellationToken);
            },
            cancellationToken);

        // A continuity refusal (e.g. final-administrator guard) surfaces as a failure;
        // binding never removes administrator authority, so in practice the mutate
        // delegate returns Ok with a typed status. Fail closed if it ever does refuse.
        return result.Succeeded && result.Value is not null
            ? result.Value
            : new WorkforceBindingResult(WorkforceBindingResultStatus.MembershipNotFound, null, null, null);
    }

    public async Task<WorkforceBindingResult> ConnectAndBindAsync(
        WorkforceConnectCommand command,
        Func<TenantContinuityContext, TenantMembership, Task>? reconcileInvitation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (command.TenantId == Guid.Empty)
            throw new ArgumentException("A resolved tenant is required.", nameof(command));
        if (command.UserId == Guid.Empty)
            throw new ArgumentException("A resolved account is required.", nameof(command));
        if (command.EmployeeId == Guid.Empty)
            throw new ArgumentException("A resolved Employee is required.", nameof(command));

        var result = await continuity.ExecuteAsync<WorkforceBindingResult>(
            command.TenantId,
            command.ActingUserId,
            async context =>
            {
                // Re-check under the lock that the account still has no membership here.
                // A membership appearing in the race means the truthful state is now
                // link/reactivate/active — refuse rather than create a second membership.
                var existing = await context.Db.TenantMemberships
                    .IgnoreQueryFilters()
                    .AnyAsync(
                        m => m.TenantId == command.TenantId && m.UserId == command.UserId,
                        cancellationToken);

                if (existing)
                {
                    return ContinuityResult<WorkforceBindingResult>.Ok(
                        new WorkforceBindingResult(WorkforceBindingResultStatus.MembershipAlreadyExists, null, command.EmployeeId, null));
                }

                var membership = TenantMembership.Create(
                    command.UserId, command.TenantId, TenantMembershipStatus.Active);
                context.Db.TenantMemberships.Add(membership);

                return await CommitBindingAsync(
                    context, membership, command.EmployeeId, command.Baseline, command.ActingUserId,
                    command.ActorName, command.ActorRole, command.AuditAction, command.AuditSummary,
                    command.CorrelationId, reconcileInvitation, cancellationToken);
            },
            cancellationToken);

        return result.Succeeded && result.Value is not null
            ? result.Value
            : new WorkforceBindingResult(WorkforceBindingResultStatus.MembershipNotFound, null, null, null);
    }

    public async Task<WorkforceCorrectionResult> CorrectAsync(
        WorkforceCorrectionCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (command.TenantId == Guid.Empty)
            throw new ArgumentException("A resolved tenant is required.", nameof(command));
        if (command.SourceEmployeeId == Guid.Empty || command.TargetEmployeeId == Guid.Empty)
            throw new ArgumentException("A resolved source and target Employee are required.", nameof(command));
        if (string.IsNullOrWhiteSpace(command.Reason))
            throw new ArgumentException("A correction reason is required.", nameof(command));

        if (command.SourceEmployeeId == command.TargetEmployeeId)
        {
            return new WorkforceCorrectionResult(WorkforceCorrectionStatus.SameEmployee, null, null);
        }

        var result = await continuity.ExecuteAsync<WorkforceCorrectionResult>(
            command.TenantId,
            command.ActingUserId,
            async context =>
            {
                // Locate the membership currently bound to the source Employee, under the
                // lock. A candidate previewed by the browser is guidance, not authority.
                var membership = await context.Db.TenantMemberships
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        m => m.TenantId == command.TenantId && m.EmployeeId == command.SourceEmployeeId,
                        cancellationToken);

                if (membership is null)
                {
                    return ContinuityResult<WorkforceCorrectionResult>.Ok(
                        new WorkforceCorrectionResult(WorkforceCorrectionStatus.SourceNotBound, null, null));
                }

                // Optimistic concurrency: the reviewed revision must still be current.
                // Any binding-affecting mutation in between bumped it, so refuse rather
                // than correct against a stale review.
                if (membership.AccessRevision != command.ExpectedRevision)
                {
                    return ContinuityResult<WorkforceCorrectionResult>.Ok(
                        new WorkforceCorrectionResult(
                            WorkforceCorrectionStatus.ConcurrencyMismatch, membership.Id, membership.AccessRevision));
                }

                // Target uniqueness: the corrected Employee must not already be bound to
                // another account in this tenant. The DB constraint is the final guard.
                var targetTaken = await context.Db.TenantMemberships
                    .IgnoreQueryFilters()
                    .AnyAsync(
                        m => m.TenantId == command.TenantId
                            && m.EmployeeId == command.TargetEmployeeId
                            && m.Id != membership.Id,
                        cancellationToken);

                if (targetTaken)
                {
                    return ContinuityResult<WorkforceCorrectionResult>.Ok(
                        new WorkforceCorrectionResult(
                            WorkforceCorrectionStatus.TargetAlreadyBound, membership.Id, membership.AccessRevision));
                }

                var beforeJson = JsonSerializer.Serialize(new
                {
                    membership.EmployeeId,
                    Status = membership.Status.ToString(),
                    membership.AccessRevision,
                });

                membership.ClearEmployee();
                membership.BindEmployee(command.TargetEmployeeId);
                await baselineService.ApplyAsync(membership, command.Baseline, cancellationToken);

                // Reconcile: any still-valid pending workforce invitation issued for the
                // source Employee is now obsolete (it would have activated the wrong
                // identity). Revoke it in the same transaction so its outstanding link
                // stops resolving; the row is kept for history.
                var obsolete = await context.Db.InviteTokens
                    .IgnoreQueryFilters()
                    .Where(t => t.TenantId == command.TenantId
                        && t.EmployeeId == command.SourceEmployeeId
                        && t.Purpose == InvitationPurpose.WorkforceAccount
                        && t.AcceptedAt == null
                        && !t.IsRevoked
                        && t.SupersededAt == null)
                    .ToListAsync(cancellationToken);
                foreach (var invitation in obsolete)
                {
                    invitation.Revoke();
                }

                // Revision bump + refresh-grant revocation, in the same transaction: a
                // token carrying the old identity fails on the very next request, so the
                // corrected person must sign in fresh.
                context.InvalidateTenantAccess(membership);

                var afterJson = JsonSerializer.Serialize(new
                {
                    membership.EmployeeId,
                    Status = membership.Status.ToString(),
                    Baseline = command.Baseline.ToString(),
                    Reason = command.Reason.Trim(),
                });

                context.Audit(AccessAuditEvent.Create(
                    context.TenantId,
                    command.ActingUserId,
                    command.ActorName,
                    command.ActorRole,
                    WorkforceAccessAuditActions.BindingCorrected,
                    WorkforceAccessAuditActions.ResourceTypeWorkforceAccount,
                    membership.Id.ToString(),
                    $"Corrected the account binding. Reason: {command.Reason.Trim()}",
                    beforeJson,
                    afterJson,
                    command.CorrelationId));

                return ContinuityResult<WorkforceCorrectionResult>.Ok(
                    new WorkforceCorrectionResult(
                        WorkforceCorrectionStatus.Corrected, membership.Id, membership.AccessRevision));
            },
            cancellationToken);

        // A continuity refusal (final-administrator guard) would surface as a failure.
        // Correction never removes administrator authority — it only swaps the Employee
        // binding and baseline slot — so in practice the delegate returns Ok with a typed
        // status. Fail closed if it ever refuses.
        return result.Succeeded && result.Value is not null
            ? result.Value
            : new WorkforceCorrectionResult(WorkforceCorrectionStatus.SourceNotBound, null, null);
    }

    /// <summary>
    /// The shared commit body: the uniqueness recheck, the additive baseline, optional
    /// invitation reconciliation, the revision bump, and the append-only audit. Both the
    /// link/reactivate path (existing membership) and the connect path (freshly created
    /// membership) run through here so they can never drift apart.
    /// </summary>
    private async Task<ContinuityResult<WorkforceBindingResult>> CommitBindingAsync(
        TenantContinuityContext context,
        TenantMembership membership,
        Guid employeeId,
        WorkforceBaseline baseline,
        Guid? actingUserId,
        string actorName,
        string actorRole,
        string auditAction,
        string auditSummary,
        string? correlationId,
        Func<TenantContinuityContext, TenantMembership, Task>? reconcileInvitation,
        CancellationToken cancellationToken)
    {
        // Clean typed outcome for the uniqueness case, ahead of the database constraint
        // that ultimately makes the race safe.
        var employeeTakenElsewhere = await context.Db.TenantMemberships
            .IgnoreQueryFilters()
            .AnyAsync(
                m => m.TenantId == context.TenantId
                    && m.EmployeeId == employeeId
                    && m.Id != membership.Id,
                cancellationToken);

        if (employeeTakenElsewhere)
        {
            return ContinuityResult<WorkforceBindingResult>.Ok(
                new WorkforceBindingResult(
                    WorkforceBindingResultStatus.EmployeeAlreadyBoundInTenant,
                    membership.Id, employeeId, membership.AccessRevision));
        }

        var beforeJson = JsonSerializer.Serialize(new
        {
            membership.EmployeeId,
            Status = membership.Status.ToString(),
            membership.AccessRevision,
        });

        membership.BindEmployee(employeeId);
        await baselineService.ApplyAsync(membership, baseline, cancellationToken);

        // Flow-specific pending-invitation reconciliation runs in the same transaction so
        // an invitation is never marked accepted/withdrawn without the binding it
        // authorized, or vice versa.
        if (reconcileInvitation is not null)
        {
            await reconcileInvitation(context, membership);
        }

        // Revision bump + refresh-grant revocation, committed with the binding: a token
        // carrying the old revision fails on the very next request.
        context.InvalidateTenantAccess(membership);

        var afterJson = JsonSerializer.Serialize(new
        {
            membership.EmployeeId,
            Status = membership.Status.ToString(),
            Baseline = baseline.ToString(),
        });

        context.Audit(AccessAuditEvent.Create(
            context.TenantId,
            actingUserId,
            actorName,
            actorRole,
            auditAction,
            WorkforceAccessAuditActions.ResourceTypeWorkforceAccount,
            membership.Id.ToString(),
            auditSummary,
            beforeJson,
            afterJson,
            correlationId));

        return ContinuityResult<WorkforceBindingResult>.Ok(
            new WorkforceBindingResult(
                WorkforceBindingResultStatus.Bound,
                membership.Id, employeeId, membership.AccessRevision));
    }
}
