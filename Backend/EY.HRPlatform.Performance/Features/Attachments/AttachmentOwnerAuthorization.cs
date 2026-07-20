using System.Security.Claims;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Attachments;

public interface IAttachmentOwnerAuthorization
{
    Task<bool> CanUploadAsync(
        string ownerType,
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<bool> CanDownloadAsync(
        string ownerType,
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}

/// <summary>
/// Fail-closed authorization for the first attachment consumer. Additional owner types must add
/// an explicit owning-feature policy before the generic attachment endpoint will accept them.
/// </summary>
public sealed class AttachmentOwnerAuthorization(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService accessPolicy,
    ICurrentUserContext currentUser,
    EffectiveReviewerResolver reviewerResolver) : IAttachmentOwnerAuthorization
{
    public const string PerformanceCycleOwnerType = "PerformanceCycle";

    public Task<bool> CanUploadAsync(
        string ownerType,
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (string.Equals(ownerType, ObjectiveProgressRules.AttachmentOwnerType, StringComparison.Ordinal))
        {
            // Progress evidence is uploaded before the update exists (ownerId null) and claimed at
            // record time; the door opens on self-manage, and record-time re-checks uploader + plan.
            return Task.FromResult(ownerId is null && accessPolicy.CanManageOwnObjectives(user));
        }

        return AuthorizeCycleAsync(
            ownerType,
            ownerId,
            accessPolicy.CanManageCycles(user),
            cancellationToken);
    }

    public Task<bool> CanDownloadAsync(
        string ownerType,
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (string.Equals(ownerType, ObjectiveProgressRules.AttachmentOwnerType, StringComparison.Ordinal))
        {
            return AuthorizeProgressEvidenceDownloadAsync(ownerId, user, cancellationToken);
        }

        return AuthorizeCycleAsync(
            ownerType,
            ownerId,
            accessPolicy.CanViewCycles(user),
            cancellationToken);
    }

    /// <summary>
    /// Progress evidence is downloadable only by the owning employee and the participant's current
    /// effective reviewer. The owner id is the progress update; we resolve its plan to find the
    /// owning employee and the campaign, then the reviewer via the shared resolver.
    /// </summary>
    private async Task<bool> AuthorizeProgressEvidenceDownloadAsync(
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (ownerId is not { } updateId)
            return false;

        var callerEmployeeId = currentUser.EmployeeId;
        if (callerEmployeeId is null)
            return false;

        // Tenant scope enforced by the global query filter on both tables.
        var update = await db.ObjectiveProgressUpdates
            .AsNoTracking()
            .Where(item => item.Id == updateId)
            .Select(item => new { item.EmployeeId, item.CycleId })
            .FirstOrDefaultAsync(cancellationToken);
        if (update is null)
            return false;

        if (update.EmployeeId == callerEmployeeId.Value && accessPolicy.CanManageOwnObjectives(user))
            return true;

        if (!accessPolicy.CanViewTeamProgress(user))
            return false;

        var effectiveReviewer = await reviewerResolver.ResolveForParticipantAsync(
            update.CycleId, update.EmployeeId, cancellationToken);
        return effectiveReviewer == callerEmployeeId.Value;
    }

    private async Task<bool> AuthorizeCycleAsync(
        string ownerType,
        Guid? ownerId,
        bool hasPermission,
        CancellationToken cancellationToken)
    {
        if (!hasPermission
            || ownerId is not { } cycleId
            || !string.Equals(ownerType, PerformanceCycleOwnerType, StringComparison.Ordinal))
        {
            return false;
        }

        // The global query filter proves that the owner exists in the caller's tenant.
        return await db.PerformanceCycles
            .AsNoTracking()
            .AnyAsync(cycle => cycle.Id == cycleId, cancellationToken);
    }
}
