namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record DraftStructureWorkspaceDto(
    string WorkspaceStatus,
    int UnitCount,
    int RootUnitCount,
    DateTime? LastModifiedAt,
    List<string> AllowedTypes,
    List<DraftOrgUnitDto> Units);