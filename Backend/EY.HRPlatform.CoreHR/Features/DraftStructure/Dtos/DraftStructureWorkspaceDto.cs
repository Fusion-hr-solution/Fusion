using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record DraftStructureWorkspaceDto(
    string WorkspaceStatus,
    int UnitCount,
    int RootUnitCount,
    DateTime? LastModifiedAt,
    DraftStructureSchemaDto DraftStructureSchema,
    List<DraftOrgUnitDto> Units);