using System.Text.Json;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>
/// Representative payloads emitted by Core's WorkforceController. Performance tests and fakes
/// share this fixture so a Core contract reshape fails in one explicit place.
/// </summary>
public static class CoreWorkforceContractFixture
{
    public static readonly Guid EmployeeId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid ManagerId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid OrgUnitId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    public const string EmployeeResponseJson = """
        {
          "data": [{
            "employeeId": "11111111-1111-1111-1111-111111111111",
            "stableEmployeeKey": "EMP-0001",
            "employeeNumber": "0001",
            "firstName": "Alice",
            "lastName": "Employee",
            "preferredName": "Alice",
            "displayName": "Alice Employee",
            "fullName": "Alice Employee",
            "workEmail": "alice.employee@example.test",
            "jobTitle": "Senior Consultant",
            "hireDate": "2024-01-15T00:00:00Z",
            "employmentStatus": "Active",
            "isActive": true,
            "orgUnit": {
              "orgUnitId": "33333333-3333-3333-3333-333333333333",
              "stableOrgUnitKey": "OU-CONSULTING",
              "name": "Consulting",
              "type": "Department",
              "parentStableOrgUnitKey": null,
              "path": "/consulting",
              "level": 1,
              "isActive": true,
              "publishedStructureVersion": 7
            },
            "manager": {
              "employeeId": "22222222-2222-2222-2222-222222222222",
              "displayName": "Mia Manager",
              "email": "mia.manager@example.test",
              "isActive": true
            },
            "directReportCount": 0,
            "dataQuality": {
              "state": "Ready",
              "hasEmployeeStateIssues": false,
              "hasOperationalBlockers": false,
              "issueCodes": []
            },
            "version": 12
          }],
          "errors": []
        }
        """;

    public const string OrgUnitResponseJson = """
        {
          "data": {
            "orgUnitId": "33333333-3333-3333-3333-333333333333",
            "stableOrgUnitKey": "OU-CONSULTING",
            "code": "CONS",
            "name": "Consulting",
            "type": "Department",
            "parentId": null,
            "responsibleManagerEmployeeId": "22222222-2222-2222-2222-222222222222",
            "isActive": true
          },
          "errors": []
        }
        """;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static CoreEmployeeSummary Employee()
        => JsonSerializer.Deserialize<ApiResponse<List<CoreEmployeeSummary>>>(EmployeeResponseJson, JsonOptions)!
            .Data!
            .Single();

    public static CoreOrgUnitDetail OrgUnit()
        => JsonSerializer.Deserialize<ApiResponse<CoreOrgUnitDetail>>(OrgUnitResponseJson, JsonOptions)!.Data!;

    public static FakeCoreWorkforceClient CreateFake()
    {
        var employee = Employee();
        var orgUnit = OrgUnit();
        var fake = new FakeCoreWorkforceClient
        {
            AllActiveResult = [employee],
            ResolvePool = [employee],
            SnapshotResolvePool = [employee],
            ByScopeResult = [employee],
            SnapshotByScopeResult = [employee],
        };
        fake.OrgUnitDetails[orgUnit.OrgUnitId] = orgUnit;
        fake.OrgUnitMembers[orgUnit.OrgUnitId] = [employee];
        return fake;
    }
}
