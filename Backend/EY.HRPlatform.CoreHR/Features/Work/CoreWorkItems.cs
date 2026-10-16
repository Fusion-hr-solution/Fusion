using EY.HRPlatform.CoreHR.Features.Setup;
using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.CoreHR.Features.Work;

/// <summary>
/// Core HR's work items (the Fusion work-item contract): unfinished foundation setup for setup
/// administrators and people still without Fusion access for workforce-access administrators. Composed
/// from the canonical readiness read and the access-roster summary; nothing is stored.
/// </summary>
public static class CoreWorkItems
{
    private const string Module = "core";

    public static IReadOnlyList<FusionWorkItemDto> Compose(Guid tenantId, CoreHRReadinessDto? readiness,
        WorkforceAccessRosterSummaryDto? access)
    {
        var items = new List<FusionWorkItemDto>();
        if (readiness is not null)
        {
            if (!readiness.Organization.IsReady)
                items.Add(Item("setup-organization", tenantId, "Finish setting up your organization",
                    "Fusion needs a published organization", "/core/organization"));
            if (WorkforceContext(readiness.Workforce) is { } context)
                items.Add(Item("setup-workforce", tenantId, "Finish setting up your workforce", context, "/core/people"));
        }
        if (access is not null)
        {
            if (access.NotInvitedCount > 0)
                items.Add(Item("access-not-invited", tenantId,
                    $"{People(access.NotInvitedCount)} {(access.NotInvitedCount == 1 ? "doesn't" : "don't")} have Fusion access yet",
                    "Workforce access", "/core/workforce-access"));
            if (access.NeedsReviewCount > 0)
                items.Add(Item("access-needs-review", tenantId,
                    $"{People(access.NeedsReviewCount)} {(access.NeedsReviewCount == 1 ? "needs" : "need")} an access review",
                    "Workforce access", "/core/workforce-access"));
        }
        return items;
    }

    /// <summary>The first workforce gap that keeps Core HR from being ready, or null when there is none.</summary>
    private static string? WorkforceContext(CoreHRWorkforceReadinessDto workforce)
    {
        if (workforce.ActiveEmployees == 0) return "No active employees yet";
        if (workforce.WithoutCurrentAssignment > 0) return $"{People(workforce.WithoutCurrentAssignment)} without a current assignment";
        if (workforce.AssignedToInactiveUnit > 0) return $"{People(workforce.AssignedToInactiveUnit)} in an inactive unit";
        if (workforce.WithInvalidManager > 0) return $"{People(workforce.WithInvalidManager)} with an invalid manager";
        if (workforce.InManagerCycle > 0) return $"{People(workforce.InManagerCycle)} in a reporting loop";
        return null;
    }

    private static string People(int count) => count == 1 ? "1 person" : $"{count} people";

    private static FusionWorkItemDto Item(string kind, Guid tenantId, string title, string? context, string href)
        => new($"{Module}:{kind}:{tenantId}", Module, kind, title, context, null, href);
}
