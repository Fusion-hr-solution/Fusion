namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;

public sealed record TenantSetupActivityDto
{
    public required Guid Id { get; init; }
    public required string ActivityType { get; init; }
    public required DateTime OccurredAt { get; init; }
    public required Guid ActorUserId { get; init; }
    public required string ActorFullName { get; init; }
    public required string ActorRole { get; init; }
    public bool IsPlatformAssisted { get; init; }
}
