using System.Security.Claims;
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
    IPerformanceAccessPolicyService accessPolicy) : IAttachmentOwnerAuthorization
{
    public const string PerformanceCycleOwnerType = "PerformanceCycle";

    public Task<bool> CanUploadAsync(
        string ownerType,
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
        => AuthorizeCycleAsync(
            ownerType,
            ownerId,
            accessPolicy.CanManageCycles(user),
            cancellationToken);

    public Task<bool> CanDownloadAsync(
        string ownerType,
        Guid? ownerId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
        => AuthorizeCycleAsync(
            ownerType,
            ownerId,
            accessPolicy.CanViewCycles(user),
            cancellationToken);

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
