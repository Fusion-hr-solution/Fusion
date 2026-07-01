using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

internal static class PerformanceCycleTestExtensions
{
    internal static PerformanceCycle ConfigureForAssignmentPreparation(this PerformanceCycle cycle)
    {
        cycle.ConfigureGovernance(
            Guid.NewGuid(),
            requireTeamObjectiveSuperiorApproval: false,
            minimumAnonymousFeedbackResponses: 3,
            CampaignFeedbackVisibility.AnonymousToSubject,
            [Guid.NewGuid()]);

        return cycle;
    }
}
