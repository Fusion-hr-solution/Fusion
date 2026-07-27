using System.Security.Cryptography;
using System.Text;

namespace EY.HRPlatform.DemoSeed;

public static class CanonicalDemoSeed
{
    public const string ManifestVersion = "canonical-fusion-tenant-v1";
    public const string DisplayName = "Atlas Group";
    public static readonly Guid TenantId = Guid.Parse("fa918a81-2147-45e0-934a-9eeec9a4ca14");
    public static readonly DateTime AsOfUtc = new(2026, 7, 1, 9, 0, 0, DateTimeKind.Utc);
    public const string TenantPassword = "Demo@123456";
    public const string PlatformPassword = "Admin@123456";
    public static string ManifestHash => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
        $"{ManifestVersion}|{TenantId:D}|320|300|20|8|32|{AsOfUtc:O}")));

    public static readonly Guid DirectorId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid[] LifecycleEmployeeIds =
    [
        Guid.Parse("20000000-0000-0000-0000-000000000101"),
        Guid.Parse("20000000-0000-0000-0000-000000000102"),
        Guid.Parse("20000000-0000-0000-0000-000000000103"),
        Guid.Parse("20000000-0000-0000-0000-000000000104"),
        Guid.Parse("20000000-0000-0000-0000-000000000105"),
        Guid.Parse("20000000-0000-0000-0000-000000000106")
    ];

    private static readonly string[] Departments =
        ["Advisory", "Assurance", "Tax", "Technology", "People & Culture", "Finance", "Client Development", "Operations"];

    private static readonly string[] FirstNames =
        ["Nadia", "Sami", "Leila", "Omar", "Meriem", "Yassine", "Amel", "Hatem", "Ines", "Karim", "Sarah", "Anis", "Mouna", "Walid", "Rania", "Fares", "Amina", "Mehdi", "Sana", "Bilel"];

    private static readonly string[] LastNames =
        ["Ben Salem", "Trabelsi", "Mansour", "Gharbi", "Jaziri", "Khelifi", "Haddad", "Ayari", "Karray", "Masmoudi", "Chaabane", "Dridi", "Sassi", "Bouslama", "Tlili", "Hamdi"];

    public static IReadOnlyList<DemoOrgUnitSpec> BuildOrgUnits()
    {
        var result = new List<DemoOrgUnitSpec>(40);
        for (var departmentIndex = 0; departmentIndex < Departments.Length; departmentIndex++)
        {
            var departmentCode = $"D{departmentIndex + 1:00}";
            result.Add(new DemoOrgUnitSpec(
                DeterministicGuid($"org:{departmentCode}"), departmentCode, Departments[departmentIndex], "Department", null));

            for (var teamIndex = 0; teamIndex < 4; teamIndex++)
            {
                var code = $"{departmentCode}-T{teamIndex + 1:00}";
                result.Add(new DemoOrgUnitSpec(
                    DeterministicGuid($"org:{code}"), code, $"{Departments[departmentIndex]} Team {teamIndex + 1}", "Team", departmentCode));
            }
        }

        return result;
    }

    public static IReadOnlyList<DemoEmployeeSpec> BuildEmployees()
    {
        var result = new List<DemoEmployeeSpec>(320);
        for (var index = 0; index < 320; index++)
        {
            var active = index < 300;
            var employeeNumber = $"ATL-{index + 1:0000}";
            var id = ResolveEmployeeId(index);
            var departmentIndex = index == 0 ? 0 : ((index - 1) / 37) % Departments.Length;
            var department = Departments[departmentIndex];
            var teamIndex = index == 0 ? 0 : ((index - 1) / 9) % 4;
            var orgCode = $"D{departmentIndex + 1:00}-T{teamIndex + 1:00}";
            var managerId = ResolveManagerId(index, departmentIndex, teamIndex);
            var name = ResolveName(index);
            var email = ResolveEmail(index, name);
            var jobTitle = ResolveJobTitle(index, department);

            result.Add(new DemoEmployeeSpec(
                id,
                employeeNumber,
                name.FirstName,
                name.LastName,
                email,
                department,
                orgCode,
                jobTitle,
                managerId,
                new DateTime(2018 + (index % 8), (index % 12) + 1, (index % 28) + 1, 9, 0, 0, DateTimeKind.Utc),
                active,
                active ? null : new DateTime(2026, 1, 15, 9, 0, 0, DateTimeKind.Utc),
                index % 3 == 0 ? "Hybrid" : index % 3 == 1 ? "Tunis" : "Remote",
                index % 5 == 0 ? "PartTime" : "FullTime"));
        }

        return result;
    }

    public static DemoEmployeeSpec GetEmployee(Guid employeeId)
        => BuildEmployees().Single(employee => employee.Id == employeeId);

    public static DemoEmployeeSpec GetEmployeeByEmail(string email)
        => BuildEmployees().Single(employee => string.Equals(employee.Email, email, StringComparison.OrdinalIgnoreCase));

    public static Guid DeterministicGuid(string key)
    {
        var bytes = SHA1.HashData(Encoding.UTF8.GetBytes($"{ManifestVersion}:{key}"));
        bytes[6] = (byte)((bytes[6] & 0x0F) | 0x50);
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80);
        return new Guid(bytes[..16]);
    }

    private static Guid ResolveEmployeeId(int index)
    {
        if (index == 0)
            return DirectorId;
        if (index >= 41 && index <= 46)
            return LifecycleEmployeeIds[index - 41];
        return DeterministicGuid($"employee:{index + 1:0000}");
    }

    private static Guid? ResolveManagerId(int index, int departmentIndex, int teamIndex)
    {
        if (index == 0)
            return null;
        if (index >= 1 && index <= 8)
            return DirectorId;

        var departmentHeadIndex = 1 + departmentIndex;
        if (index >= 9 && index <= 40)
            return ResolveEmployeeId(departmentHeadIndex);

        var managerIndex = 9 + (departmentIndex * 4) + teamIndex;
        return ResolveEmployeeId(managerIndex);
    }

    private static (string FirstName, string LastName) ResolveName(int index)
    {
        if (index == 0)
            return ("Flit", "Manager");
        if (index >= 41 && index <= 46)
        {
            var lifecycle = new[]
            {
                ("Nour", "Pending"), ("Yassine", "Draft"), ("Meriem", "Submitted"),
                ("Oussama", "Manager Review"), ("Amel", "Finalized"), ("Hatem", "Acknowledged")
            };
            return lifecycle[index - 41];
        }

        return (FirstNames[index % FirstNames.Length], LastNames[(index / FirstNames.Length) % LastNames.Length]);
    }

    private static string ResolveEmail(int index, (string FirstName, string LastName) name)
    {
        if (index == 0)
            return "flit.manager@atlas.example";
        if (index >= 41 && index <= 46)
            return $"{name.FirstName.ToLowerInvariant()}.{name.LastName.Replace(" ", ".").ToLowerInvariant()}@atlas.example";
        return $"employee{index + 1:0000}@atlas.example";
    }

    private static string ResolveJobTitle(int index, string department)
    {
        if (index == 0) return "Managing Director";
        if (index <= 8) return $"{department} Director";
        if (index <= 40) return $"{department} Team Manager";
        return (index % 4) switch
        {
            0 => $"Senior {department} Consultant",
            1 => $"{department} Consultant",
            2 => $"{department} Analyst",
            _ => $"Junior {department} Associate"
        };
    }

}

public sealed record DemoOrgUnitSpec(Guid Id, string Code, string Name, string Type, string? ParentCode);

public sealed record DemoEmployeeSpec(
    Guid Id,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string Email,
    string Department,
    string OrgUnitCode,
    string JobTitle,
    Guid? ManagerId,
    DateTime HireDate,
    bool IsActive,
    DateTime? EndDate,
    string WorkLocation,
    string EmploymentType);
