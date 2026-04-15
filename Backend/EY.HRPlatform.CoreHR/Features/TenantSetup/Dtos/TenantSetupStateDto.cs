namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;

public sealed record TenantSetupStateDto
{
    public uint? Version { get; init; }
    public required string CurrentPhase { get; init; }
    public int CurrentStep { get; init; }
    public int TotalSteps { get; init; }
    public required string NextAction { get; init; }
    public required List<string> CompletedSteps { get; init; }
    public required List<string> PendingSteps { get; init; }
    public bool CanStartSetup { get; init; }
    public bool CanResumeSetup { get; init; }
    public DateTime? ActivatedAt { get; init; }
    public DateTime? StructurallyGovernedAt { get; init; }
    public DateTime? StructurallyPublishedAt { get; init; }
    public DateTime? OperationalAt { get; init; }
}