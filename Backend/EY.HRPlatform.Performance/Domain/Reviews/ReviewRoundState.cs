namespace EY.HRPlatform.Performance.Domain.Reviews;

public enum ReviewRoundState { Draft = 0, Active = 1, Closed = 2 }

public enum PerformanceReviewState
{
    SelfAssessment = 0,
    ManagerAssessment = 1,
    Calibration = 2,
    ReadyToFinalize = 3,
    Finalized = 4,
    Closed = 5,
}
