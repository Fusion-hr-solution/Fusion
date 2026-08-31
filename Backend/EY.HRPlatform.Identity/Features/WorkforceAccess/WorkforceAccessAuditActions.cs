namespace EY.HRPlatform.Identity.Features.WorkforceAccess;

/// <summary>
/// The closed vocabulary of workforce access-audit events, written on the existing
/// append-only <c>AccessAuditEvent</c> substrate. Like the administrator vocabulary,
/// these names are business language shown to customers, and the set is closed: an
/// event this capability can produce has a name here, and a name here has an event
/// that produces it. Every workforce audit record also carries the stable
/// tenant/actor/target-User/membership/Employee/invitation/correlation identifiers
/// and, where relevant, before/after binding and baseline values.
/// </summary>
public static class WorkforceAccessAuditActions
{
    public const string ResourceTypeWorkforceAccount = "WorkforceAccount";
    public const string ResourceTypeWorkforceInvitation = "WorkforceInvitation";
    public const string ResourceTypeWorkforceBinding = "WorkforceBinding";

    // Invitation lifecycle.
    public const string InvitationIssued = "WorkforceInvitationIssued";
    public const string InvitationResent = "WorkforceInvitationResent";
    public const string InvitationWithdrawn = "WorkforceInvitationWithdrawn";

    // Account / membership activation.
    public const string AccountActivated = "WorkforceAccountActivated";
    public const string ExistingAccountJoinedTenant = "WorkforceExistingAccountJoinedTenant";
    public const string ExistingAccountLinked = "WorkforceExistingAccountLinked";
    public const string MembershipReactivated = "WorkforceMembershipReactivated";

    // Baseline and lifecycle.
    public const string BaselineApplied = "WorkforceBaselineApplied";
    public const string MembershipSuspended = "WorkforceMembershipSuspended";
    public const string MembershipReactivatedForLifecycle = "WorkforceMembershipLifecycleReactivated";

    // Correction.
    public const string BindingCorrected = "WorkforceBindingCorrected";
}
