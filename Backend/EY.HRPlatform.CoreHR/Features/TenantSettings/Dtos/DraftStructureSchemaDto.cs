namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

public sealed record DraftStructureSchemaDto
{
    public List<OrgUnitKindDto> OrgUnitKinds { get; init; } = DefaultOrgUnitKinds;

    public List<DraftStructureAttributeDefinitionDto> Attributes { get; init; } = [];

    public static DraftStructureSchemaDto Defaults => new();

    public static List<OrgUnitKindDto> DefaultOrgUnitKinds =>
    [
        new("department", "Department"),
        new("team", "Team")
    ];
}

public sealed record OrgUnitKindDto(string Key, string DisplayLabel);

public sealed record DraftStructureAttributeDefinitionDto(
    string Key,
    string DisplayLabel,
    string ValueType,
    bool Required,
    List<string>? AppliesToKindKeys = null,
    List<string>? AllowedValues = null);