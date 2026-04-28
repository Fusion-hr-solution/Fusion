namespace EY.HRPlatform.Interview.Features.Candidates;

public static class CandidateProgressMilestones
{
    public const string Invited = "Invited";
    public const string LinkOpened = "LinkOpened";
    public const string Started = "Started";
    public const string InProgress = "InProgress";
    public const string Submitted = "Submitted";

    public static readonly string[] TimelineOrder =
    [
        Invited,
        LinkOpened,
        Started,
        InProgress,
        Submitted,
    ];
}
