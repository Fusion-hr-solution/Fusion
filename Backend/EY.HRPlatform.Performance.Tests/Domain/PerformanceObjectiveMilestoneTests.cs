using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Tests.Domain;

public sealed class PerformanceObjectiveMilestoneTests
{
    [Fact]
    public void Create_RequiresAValidDueDateAndStartsIncomplete()
    {
        var milestone = PerformanceObjectiveMilestone.Create(
            Guid.NewGuid(), Guid.NewGuid(), "Complete pilot", DateTime.UtcNow.AddDays(7));

        Assert.False(milestone.IsCompleted);
        Assert.Equal("Complete pilot", milestone.Title);
    }
}
