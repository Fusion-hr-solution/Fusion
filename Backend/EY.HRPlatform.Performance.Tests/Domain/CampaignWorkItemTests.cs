using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Tests.Domain;

public sealed class CampaignWorkItemTests
{
    [Fact]
    public void Submit_AssignedSelfReview_MovesTaskToSubmitted()
    {
        var workItem = CampaignWorkItem.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(7));

        workItem.Submit(DateTime.UtcNow);

        Assert.Equal(CampaignWorkItemStatus.Submitted, workItem.Status);
        Assert.NotNull(workItem.SubmittedAt);
    }
}
