using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceCycleStatusTests
{
    [Fact]
    public void Lifecycle_DoesNotExposeRetiredPublishedStatus()
    {
        Assert.DoesNotContain("Published", Enum.GetNames<PerformanceCycleStatus>());
    }
}
