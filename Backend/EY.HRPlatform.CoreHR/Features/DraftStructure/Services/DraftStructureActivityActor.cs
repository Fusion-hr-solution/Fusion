namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public sealed record DraftStructureActivityActor(
    Guid UserId,
    string FullName,
    string Role,
    bool IsPlatformAssisted);
