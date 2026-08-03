using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// The two invitation routes stay separate.
///
/// Core's workforce invitation route is unchanged and keeps its own behaviour;
/// what these prove is that a bootstrap invitation can never be dispatched into
/// it, so administrator activation cannot be completed through a path that knows
/// nothing about tenant membership, entitlements or tenant activation.
/// </summary>
public sealed class BootstrapRouteSeparationTests
{
    [Fact]
    public void A_bootstrap_invitation_carries_no_workforce_token()
    {
        var invitation = InviteToken.CreateOrganizationBootstrap(
            "admin@atlas.example", Guid.NewGuid(), Guid.NewGuid());

        // The workforce route looks an invitation up by its raw token. A bootstrap
        // invitation has none, so there is nothing for that lookup to match — the
        // separation is structural, not a check that could be forgotten.
        Assert.Null(invitation.Token);
        Assert.Equal(InvitationPurpose.OrganizationBootstrap, invitation.Purpose);
    }

    [Fact]
    public void A_workforce_invitation_still_carries_its_token_and_purpose()
    {
        var invitation = InviteToken.Create(
            "employee@atlas.example", Guid.NewGuid(), PlatformRole.Employee, Guid.NewGuid());

        Assert.False(string.IsNullOrWhiteSpace(invitation.Token));
        Assert.Equal(InvitationPurpose.WorkforceAccount, invitation.Purpose);
    }

    [Fact]
    public void Purpose_is_bound_at_creation_and_never_inferred_from_the_role()
    {
        // Both carry an administrator role. Only the purpose distinguishes them,
        // which is why the routes filter on purpose rather than on role.
        var bootstrap = InviteToken.CreateOrganizationBootstrap(
            "admin@atlas.example", Guid.NewGuid(), Guid.NewGuid());
        var workforce = InviteToken.Create(
            "admin@atlas.example", Guid.NewGuid(), PlatformRole.OrgAdmin, Guid.NewGuid());

        Assert.Equal(PlatformRole.OrgAdmin, bootstrap.Role);
        Assert.Equal(PlatformRole.OrgAdmin, workforce.Role);
        Assert.NotEqual(bootstrap.Purpose, workforce.Purpose);
    }
}
