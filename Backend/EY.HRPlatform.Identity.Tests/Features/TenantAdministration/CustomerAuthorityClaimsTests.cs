using System.Security.Claims;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Features.TenantAdministration;

/// <summary>
/// What the Gateway concludes a token is asserting, before it checks whether that
/// assertion is still true.
/// <para>
/// The distinction under test is the whole mechanism: a token with no tenancy is
/// waved through because there is nothing to revoke, while a token that names a
/// tenant must prove its authority. Collapsing those two cases would let any
/// token whose authority cannot be read skip the check entirely.
/// </para>
/// </summary>
public sealed class CustomerAuthorityClaimsTests
{
    private static readonly Guid User = Guid.NewGuid();
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid Membership = Guid.NewGuid();

    [Fact]
    public void A_token_with_no_tenancy_is_not_a_customer_request()
    {
        // The normal Platform Administrator shape, and the shape of an account
        // with zero or several active memberships.
        var read = CustomerAuthorityClaims.Read(Principal(
            (ClaimTypes.NameIdentifier, User.ToString())));

        Assert.Equal(CustomerClaimsKind.None, read.Kind);
    }

    [Fact]
    public void A_complete_token_carries_the_authority_to_be_checked()
    {
        var read = CustomerAuthorityClaims.Read(Principal(
            (ClaimTypes.NameIdentifier, User.ToString()),
            (CustomClaimTypes.TenantId, Tenant.ToString()),
            (CustomClaimTypes.TenantMembershipId, Membership.ToString()),
            (CustomClaimTypes.MembershipAccessRevision, "7")));

        Assert.Equal(CustomerClaimsKind.Complete, read.Kind);
        Assert.Equal(new TenantAuthorityStateRequest(User, Tenant, Membership, 7), read.Claims);
    }

    [Fact]
    public void A_token_issued_before_the_access_revision_existed_is_incomplete_not_absent()
    {
        // This is the regression that matters. A token minted before this change
        // still names its tenant and membership but carries no revision. Reading
        // it as "no customer context" would forward it unchecked, so every token
        // issued before the cutover would outlive a suspension until it expired.
        var read = CustomerAuthorityClaims.Read(Principal(
            (ClaimTypes.NameIdentifier, User.ToString()),
            (CustomClaimTypes.TenantId, Tenant.ToString()),
            (CustomClaimTypes.TenantMembershipId, Membership.ToString())));

        Assert.Equal(CustomerClaimsKind.Incomplete, read.Kind);
        Assert.Null(read.Claims);
    }

    [Theory]
    [InlineData("not-a-number")]
    [InlineData("")]
    public void A_token_whose_revision_cannot_be_read_is_incomplete(string revision)
    {
        var read = CustomerAuthorityClaims.Read(Principal(
            (ClaimTypes.NameIdentifier, User.ToString()),
            (CustomClaimTypes.TenantId, Tenant.ToString()),
            (CustomClaimTypes.TenantMembershipId, Membership.ToString()),
            (CustomClaimTypes.MembershipAccessRevision, revision)));

        Assert.Equal(CustomerClaimsKind.Incomplete, read.Kind);
    }

    [Fact]
    public void A_token_naming_a_tenant_but_no_membership_is_incomplete()
    {
        // Half a customer context is still a claim of customer authority, and it
        // cannot be verified — so it is not waved through.
        var read = CustomerAuthorityClaims.Read(Principal(
            (ClaimTypes.NameIdentifier, User.ToString()),
            (CustomClaimTypes.TenantId, Tenant.ToString())));

        Assert.Equal(CustomerClaimsKind.Incomplete, read.Kind);
    }

    [Fact]
    public void A_token_with_an_unreadable_tenant_identifier_is_incomplete()
    {
        var read = CustomerAuthorityClaims.Read(Principal(
            (ClaimTypes.NameIdentifier, User.ToString()),
            (CustomClaimTypes.TenantId, "not-a-guid"),
            (CustomClaimTypes.TenantMembershipId, Membership.ToString()),
            (CustomClaimTypes.MembershipAccessRevision, "1")));

        Assert.Equal(CustomerClaimsKind.Incomplete, read.Kind);
    }

    private static ClaimsPrincipal Principal(params (string Type, string Value)[] claims)
        => new(new ClaimsIdentity(
            claims.Select(claim => new Claim(claim.Type, claim.Value)),
            authenticationType: "Test"));
}
