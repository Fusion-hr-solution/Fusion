namespace EY.HRPlatform.Identity.Features.WorkforceAccess;

/// <summary>The trusted existing-account transactions a workforce mutation may request.</summary>
public enum WorkforceAccessMutationAction
{
    /// <summary>Link a same-tenant Active account with no Employee binding.</summary>
    Link,

    /// <summary>Reactivate a suspended membership here and link it in the same commit.</summary>
    ReactivateAndLink,

    /// <summary>Connect an available global account into this tenant.</summary>
    Connect,
}

/// <summary>
/// A trusted, already-resolved mutation request. CoreHR has re-resolved the canonical
/// Employee, tenant ownership, work email, and reviewed baseline before this reaches
/// Identity. The <paramref name="Action"/> is what the operator confirmed against a
/// previously previewed candidate — never authority on its own.
/// </summary>
public sealed record WorkforceAccessMutationRequest(
    Guid TenantId,
    Guid EmployeeId,
    string? NormalizedWorkEmail,
    WorkforceAccessMutationAction Action,
    WorkforceBaseline Baseline,
    Guid? ActingUserId,
    string ActorName,
    string ActorRole,
    string? CorrelationId = null);

/// <summary>The typed, non-disclosing outcome of a workforce mutation.</summary>
public enum WorkforceAccessMutationOutcome
{
    /// <summary>The transaction committed.</summary>
    Ok,

    /// <summary>The account state no longer matches the requested action; re-resolve.</summary>
    Stale,

    /// <summary>A binding conflict or uniqueness collision blocks the action.</summary>
    Conflict,

    /// <summary>The account is unavailable (active in another tenant); no other-tenant identity disclosed.</summary>
    Unavailable,
}

public sealed record WorkforceAccessMutationResult(
    WorkforceAccessMutationOutcome Outcome,
    string AccountState,
    Guid? MembershipId,
    int? AccessRevision,
    string Message);

public interface IWorkforceAccessMutationService
{
    Task<WorkforceAccessMutationResult> MutateAsync(
        WorkforceAccessMutationRequest request,
        CancellationToken cancellationToken);
}

/// <summary>
/// Maps a re-resolved account candidate to the correct atomic binding action. Candidate
/// preview and mutation stay separate concerns: this re-resolves the candidate under the
/// current state and refuses (typed <see cref="WorkforceAccessMutationOutcome.Stale"/>)
/// when the requested action no longer matches, rather than trusting the operator's
/// earlier preview. It never creates duplicate accounts or memberships and never crosses
/// a tenant boundary.
/// </summary>
public sealed class WorkforceAccessMutationService(
    IWorkforceAccountCandidateResolver candidateResolver,
    IWorkforceIdentityBindingService bindingService) : IWorkforceAccessMutationService
{
    public async Task<WorkforceAccessMutationResult> MutateAsync(
        WorkforceAccessMutationRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.TenantId == Guid.Empty)
            throw new ArgumentException("A resolved tenant is required.", nameof(request));
        if (request.EmployeeId == Guid.Empty)
            throw new ArgumentException("A resolved Employee is required.", nameof(request));

        // Re-resolve now. A candidate returned to the operator earlier is guidance, not
        // authority; the truthful state is whatever the resolver says at commit time.
        var candidate = await candidateResolver.ResolveAsync(
            request.TenantId, request.EmployeeId, request.NormalizedWorkEmail, cancellationToken);

        var stateName = candidate.Outcome.ToString();

        // Terminal, non-actionable states are reported truthfully and never mutated.
        switch (candidate.Outcome)
        {
            case WorkforceAccountCandidateOutcome.Active:
                return Stale(stateName, "This account is already active for this employee.");
            case WorkforceAccountCandidateOutcome.BindingConflict:
                return new WorkforceAccessMutationResult(
                    WorkforceAccessMutationOutcome.Conflict, stateName, candidate.MembershipId, null,
                    "This account is bound to a different employee. Use correction.");
            case WorkforceAccountCandidateOutcome.AccountUnavailable:
                return new WorkforceAccessMutationResult(
                    WorkforceAccessMutationOutcome.Unavailable, stateName, null, null,
                    "This account is active in another workspace and cannot be used here.");
            case WorkforceAccountCandidateOutcome.NewAccount:
                return Stale(stateName, "There is no existing account to link. Activate a new account instead.");
        }

        // Actionable states: the requested action must match the current outcome exactly,
        // or the operator is acting on a stale preview.
        return request.Action switch
        {
            WorkforceAccessMutationAction.Link
                when candidate.Outcome == WorkforceAccountCandidateOutcome.ExistingAccountReadyToLink
                => await BindExistingAsync(request, candidate, reactivate: false,
                    WorkforceAccessAuditActions.ExistingAccountLinked, "Linked an existing account.", cancellationToken),

            WorkforceAccessMutationAction.ReactivateAndLink
                when candidate.Outcome == WorkforceAccountCandidateOutcome.SuspendedAccountReadyToReactivate
                => await BindExistingAsync(request, candidate, reactivate: true,
                    WorkforceAccessAuditActions.MembershipReactivated, "Reactivated a suspended membership and linked it.", cancellationToken),

            WorkforceAccessMutationAction.Connect
                when candidate.Outcome == WorkforceAccountCandidateOutcome.ExistingAccountReadyToJoinTenant
                => await ConnectAsync(request, candidate, cancellationToken),

            _ => Stale(stateName,
                $"This account is now '{stateName}', which does not match the requested action. Review it again."),
        };
    }

    private async Task<WorkforceAccessMutationResult> BindExistingAsync(
        WorkforceAccessMutationRequest request,
        WorkforceAccountCandidate candidate,
        bool reactivate,
        string auditAction,
        string auditSummary,
        CancellationToken cancellationToken)
    {
        if (candidate.MembershipId is not { } membershipId)
        {
            return Stale(candidate.Outcome.ToString(), "The account state changed. Review it again.");
        }

        var result = await bindingService.BindAsync(
            new WorkforceBindingCommand(
                request.TenantId, membershipId, request.EmployeeId, request.Baseline,
                request.ActingUserId, request.ActorName, request.ActorRole,
                auditAction, auditSummary, request.CorrelationId,
                ReactivateSuspendedMembership: reactivate),
            reconcileInvitation: null,
            cancellationToken);

        return FromBinding(result, candidate.Outcome.ToString());
    }

    private async Task<WorkforceAccessMutationResult> ConnectAsync(
        WorkforceAccessMutationRequest request,
        WorkforceAccountCandidate candidate,
        CancellationToken cancellationToken)
    {
        if (candidate.UserId is not { } userId)
        {
            return Stale(candidate.Outcome.ToString(), "The account state changed. Review it again.");
        }

        var result = await bindingService.ConnectAndBindAsync(
            new WorkforceConnectCommand(
                request.TenantId, userId, request.EmployeeId, request.Baseline,
                request.ActingUserId, request.ActorName, request.ActorRole,
                WorkforceAccessAuditActions.ExistingAccountJoinedTenant,
                "Connected an existing account into this tenant.", request.CorrelationId),
            reconcileInvitation: null,
            cancellationToken);

        return FromBinding(result, candidate.Outcome.ToString());
    }

    private static WorkforceAccessMutationResult FromBinding(WorkforceBindingResult result, string stateName)
        => result.Status switch
        {
            WorkforceBindingResultStatus.Bound => new WorkforceAccessMutationResult(
                WorkforceAccessMutationOutcome.Ok, "Active", result.MembershipId, result.AccessRevision,
                "Workforce access is now active."),

            WorkforceBindingResultStatus.EmployeeAlreadyBoundInTenant => new WorkforceAccessMutationResult(
                WorkforceAccessMutationOutcome.Conflict, stateName, result.MembershipId, result.AccessRevision,
                "This employee is already linked to another account in this workspace."),

            WorkforceBindingResultStatus.AlreadyBoundToDifferentEmployee => new WorkforceAccessMutationResult(
                WorkforceAccessMutationOutcome.Conflict, stateName, result.MembershipId, result.AccessRevision,
                "This account is bound to a different employee. Use correction."),

            // MembershipNotFound / MembershipAlreadyExists both mean the previewed state
            // is no longer current: fail closed and ask the caller to re-resolve.
            _ => new WorkforceAccessMutationResult(
                WorkforceAccessMutationOutcome.Stale, stateName, null, null,
                "The account state changed before this could commit. Review it again."),
        };

    private static WorkforceAccessMutationResult Stale(string stateName, string message)
        => new(WorkforceAccessMutationOutcome.Stale, stateName, null, null, message);
}
