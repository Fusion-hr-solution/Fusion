using EY.HRPlatform.Identity.Features.WorkforceAccess;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

/// <summary>One trusted workforce subject CoreHR has already resolved canonically.</summary>
public sealed record InternalWorkforceCandidateSubject(Guid EmployeeId, string? NormalizedWorkEmail);

public sealed record InternalWorkforceCandidatesRequest(
    Guid TenantId,
    IReadOnlyList<InternalWorkforceCandidateSubject> Subjects);

/// <summary>
/// A trusted existing-account mutation CoreHR has fully resolved: the canonical Employee,
/// its normalized work email, the reviewed baseline, and the operator-confirmed action.
/// Identity re-resolves the candidate and rechecks state before committing.
/// </summary>
public sealed record InternalWorkforceMutationRequest(
    Guid TenantId,
    Guid EmployeeId,
    string? NormalizedWorkEmail,
    string Action,
    string Baseline,
    Guid? ActingUserId,
    string ActorName,
    string ActorRole,
    string? CorrelationId);

public sealed record InternalWorkforceMutationResponse(
    string Outcome,
    string AccountState,
    Guid? MembershipId,
    int? AccessRevision,
    string Message);

/// <summary>
/// A trusted single-person correction CoreHR has fully resolved: the currently-bound
/// source Employee, the corrected target Employee (both canonical, tenant-owned), the
/// reviewed baseline, the required reason, and the reviewed access revision. Identity
/// re-reads and rechecks the binding under the tenant lock before rebinding.
/// </summary>
public sealed record InternalWorkforceCorrectionRequest(
    Guid TenantId,
    Guid SourceEmployeeId,
    Guid TargetEmployeeId,
    string Baseline,
    string Reason,
    int ExpectedRevision,
    Guid? ActingUserId,
    string ActorName,
    string ActorRole,
    string? CorrelationId);

/// <summary>
/// The trusted CoreHR-to-Identity workforce boundary. Only a signed internal caller
/// (CoreHR) reaches it, and CoreHR has already resolved the canonical Employee,
/// tenant ownership, and normalized work email — this endpoint never accepts those
/// facts from a browser. Identity rechecks account/membership/binding state and
/// returns bounded, non-disclosing candidate outcomes. Authoritative mutations
/// (activate, link, connect, reactivate, correct) attach to this same controller.
/// </summary>
[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/identity/workforce-access")]
public sealed class InternalWorkforceAccessController(
    IInternalServiceRequestAuthorizer authorizer,
    IWorkforceAccountCandidateResolver candidateResolver,
    IWorkforceAccessMutationService mutationService,
    IWorkforceIdentityBindingService bindingService) : ControllerBase
{
    [HttpPost("candidates")]
    public async Task<ActionResult<IReadOnlyList<WorkforceAccountCandidate>>> Candidates(
        [FromBody] InternalWorkforceCandidatesRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
        {
            return Unauthorized();
        }

        if (request.TenantId == Guid.Empty)
        {
            return BadRequest("A resolved tenant is required.");
        }

        var results = await candidateResolver.ResolveManyAsync(
            request.TenantId,
            request.Subjects
                .Select(subject => new WorkforceAccountCandidateSubject(
                    subject.EmployeeId,
                    subject.NormalizedWorkEmail))
                .ToArray(),
            cancellationToken);

        return Ok(results);
    }

    /// <summary>
    /// Commits one trusted existing-account transaction — link, reactivate-and-link, or
    /// connect. Identity re-resolves the candidate and rechecks membership/binding state
    /// under the tenant lock before mutating; a previously previewed candidate is never
    /// authority here. Returns a typed, non-disclosing outcome.
    /// </summary>
    [HttpPost("mutate")]
    public async Task<ActionResult<InternalWorkforceMutationResponse>> Mutate(
        [FromBody] InternalWorkforceMutationRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
        {
            return Unauthorized();
        }

        if (request.TenantId == Guid.Empty || request.EmployeeId == Guid.Empty)
        {
            return BadRequest("A resolved tenant and Employee are required.");
        }

        if (!Enum.TryParse<WorkforceAccessMutationAction>(request.Action, ignoreCase: true, out var action))
        {
            return BadRequest($"Unknown workforce action '{request.Action}'.");
        }

        if (!Enum.TryParse<WorkforceBaseline>(request.Baseline, ignoreCase: true, out var baseline))
        {
            return BadRequest($"Unknown workforce baseline '{request.Baseline}'.");
        }

        var result = await mutationService.MutateAsync(
            new WorkforceAccessMutationRequest(
                request.TenantId,
                request.EmployeeId,
                request.NormalizedWorkEmail,
                action,
                baseline,
                request.ActingUserId,
                request.ActorName,
                request.ActorRole,
                request.CorrelationId),
            cancellationToken);

        return Ok(new InternalWorkforceMutationResponse(
            result.Outcome.ToString(),
            result.AccountState,
            result.MembershipId,
            result.AccessRevision,
            result.Message));
    }

    /// <summary>
    /// Corrects one account's Employee binding: rebinds the membership currently bound to
    /// the source Employee onto the corrected target Employee, atomically, with optimistic
    /// concurrency, target uniqueness, obsolete-invitation reconciliation, revision bump,
    /// and append-only reasoned audit. Returns a typed, non-disclosing outcome mapped to
    /// the shared command vocabulary (Ok / Stale / Conflict / Blocked).
    /// </summary>
    [HttpPost("correct")]
    public async Task<ActionResult<InternalWorkforceMutationResponse>> Correct(
        [FromBody] InternalWorkforceCorrectionRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
        {
            return Unauthorized();
        }

        if (request.TenantId == Guid.Empty
            || request.SourceEmployeeId == Guid.Empty
            || request.TargetEmployeeId == Guid.Empty)
        {
            return BadRequest("A resolved tenant, source Employee, and target Employee are required.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest("A correction reason is required.");
        }

        if (!Enum.TryParse<WorkforceBaseline>(request.Baseline, ignoreCase: true, out var baseline))
        {
            return BadRequest($"Unknown workforce baseline '{request.Baseline}'.");
        }

        var result = await bindingService.CorrectAsync(
            new WorkforceCorrectionCommand(
                request.TenantId,
                request.SourceEmployeeId,
                request.TargetEmployeeId,
                baseline,
                request.Reason,
                request.ExpectedRevision,
                request.ActingUserId,
                request.ActorName,
                request.ActorRole,
                request.CorrelationId),
            cancellationToken);

        var (outcome, message) = result.Status switch
        {
            WorkforceCorrectionStatus.Corrected =>
                ("Ok", "The account is now linked to the corrected person. They must sign in again."),
            WorkforceCorrectionStatus.TargetAlreadyBound =>
                ("Conflict", "That person is already linked to another account in this workspace."),
            WorkforceCorrectionStatus.ConcurrencyMismatch =>
                ("Stale", "This account changed since you reviewed it. Review it again."),
            WorkforceCorrectionStatus.SourceNotBound =>
                ("Stale", "This account is no longer linked to that person. Review it again."),
            WorkforceCorrectionStatus.SameEmployee =>
                ("Blocked", "The account is already linked to this person."),
            _ => ("Failed", "The correction could not be completed."),
        };

        return Ok(new InternalWorkforceMutationResponse(
            outcome,
            result.Status.ToString(),
            result.MembershipId,
            result.AccessRevision,
            message));
    }
}
