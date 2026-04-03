namespace EY.HRPlatform.Interview.Models;

public sealed class InterviewDto
{
    public Guid Id { get; init; }
    public string CandidateName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public string Status { get; init; } = "scheduled";
    public string ScheduledAt { get; init; } = string.Empty;
}