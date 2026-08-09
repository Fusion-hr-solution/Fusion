namespace EY.HRPlatform.CoreHR.Domain.Entities;

public static class OrganizationalUnitTypeCatalog
{
    public static readonly Guid OrganizationId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid BusinessUnitId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid DivisionId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static readonly Guid DepartmentId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    public static readonly Guid TeamId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    public static readonly Guid UnitId = Guid.Parse("66666666-6666-6666-6666-666666666666");

    public static IReadOnlyList<(Guid Id, string Name)> BuiltIns { get; } =
    [
        (OrganizationId, "Organization"),
        (BusinessUnitId, "Business Unit"),
        (DivisionId, "Division"),
        (DepartmentId, "Department"),
        (TeamId, "Team"),
        (UnitId, "Unit"),
    ];
}
