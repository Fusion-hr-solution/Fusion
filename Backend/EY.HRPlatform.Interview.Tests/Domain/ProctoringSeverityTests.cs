using EY.HRPlatform.Interview.Domain;

namespace EY.HRPlatform.Interview.Tests.Domain;

public class ProctoringSeverityTests
{
    [Theory]
    [InlineData(ProctoringEventTypes.SecondPerson, ProctoringSeverity.High)]
    [InlineData(ProctoringEventTypes.ProhibitedObject, ProctoringSeverity.High)]
    [InlineData(ProctoringEventTypes.CandidateAbsent, ProctoringSeverity.Medium)]
    [InlineData(ProctoringEventTypes.LookingAway, ProctoringSeverity.Medium)]
    [InlineData(ProctoringEventTypes.CameraDenied, ProctoringSeverity.Medium)]
    [InlineData(ProctoringEventTypes.CameraLost, ProctoringSeverity.Medium)]
    [InlineData(ProctoringEventTypes.TabFocusLoss, ProctoringSeverity.Low)]
    [InlineData(ProctoringEventTypes.Paste, ProctoringSeverity.Low)]
    [InlineData(ProctoringEventTypes.SecondDisplay, ProctoringSeverity.Low)]
    public void ForType_MapsEachSignalToItsSeverity(string type, string expected)
    {
        Assert.Equal(expected, ProctoringSeverity.ForType(type));
    }

    [Fact]
    public void RollUp_ReturnsHighestSeverityPresent()
    {
        Assert.Equal(
            ProctoringSeverity.High,
            ProctoringSeverity.RollUp([ProctoringSeverity.Low, ProctoringSeverity.High, ProctoringSeverity.Medium]));

        Assert.Equal(
            ProctoringSeverity.Medium,
            ProctoringSeverity.RollUp([ProctoringSeverity.Low, ProctoringSeverity.Medium]));

        Assert.Equal(ProctoringSeverity.Low, ProctoringSeverity.RollUp([ProctoringSeverity.Low]));
    }

    [Fact]
    public void RollUp_EmptyIsNone()
    {
        Assert.Equal(ProctoringSeverity.None, ProctoringSeverity.RollUp([]));
    }
}
