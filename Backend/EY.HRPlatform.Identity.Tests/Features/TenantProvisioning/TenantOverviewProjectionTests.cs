using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantProvisioning;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// The overview's whole job is telling a Platform Administrator where action is
/// required. These pin the derivation, because a list that cries wolf is worse
/// than no list at all.
/// </summary>
public sealed class TenantOverviewAttentionTests
{
    [Fact]
    public void A_successfully_delivered_pending_invitation_is_not_an_attention_problem()
    {
        // This is the case that makes the whole filter trustworthy: the tenant is
        // waiting on its recipient, not on the platform.
        Assert.Equal(
            TenantAttentionReason.None,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Pending, InvitationDeliveryOutcome.Sent));
    }

    [Fact]
    public void A_pending_invitation_whose_delivery_failed_needs_attention()
    {
        Assert.Equal(
            TenantAttentionReason.DeliveryFailed,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Pending, InvitationDeliveryOutcome.Failed));
    }

    [Fact]
    public void An_expired_invitation_needs_attention()
    {
        Assert.Equal(
            TenantAttentionReason.InvitationExpired,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Expired, InvitationDeliveryOutcome.Sent));
    }

    [Fact]
    public void A_revoked_invitation_with_no_replacement_needs_attention()
    {
        Assert.Equal(
            TenantAttentionReason.InvitationRevoked,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Revoked, InvitationDeliveryOutcome.Sent));
    }

    [Fact]
    public void A_revoked_invitation_that_was_replaced_does_not_need_attention()
    {
        // Replacing supersedes the predecessor, so it reports Superseded rather
        // than Revoked. The tenant has a live route in and needs nothing.
        Assert.Equal(
            TenantAttentionReason.None,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Superseded, InvitationDeliveryOutcome.Sent));
    }

    [Fact]
    public void An_accepted_invitation_needs_nothing()
    {
        Assert.Equal(
            TenantAttentionReason.None,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Accepted, InvitationDeliveryOutcome.Sent));
    }

    [Fact]
    public void A_tenant_with_no_invitation_needs_nothing()
    {
        Assert.Equal(
            TenantAttentionReason.None,
            TenantOverviewProjection.DeriveAttention(state: null, lastDeliveryOutcome: null));
    }

    [Fact]
    public void A_pending_invitation_with_no_recorded_delivery_yet_needs_nothing()
    {
        // Delivery is post-commit, so a row can briefly exist before its first
        // attempt. Absence of an attempt is not evidence of failure.
        Assert.Equal(
            TenantAttentionReason.None,
            TenantOverviewProjection.DeriveAttention(
                InvitationState.Pending, lastDeliveryOutcome: null));
    }
}
