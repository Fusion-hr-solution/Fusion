using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

public sealed class CoreWorkforceContractFixtureTests
{
    [Fact]
    public void RepresentativeCorePayloads_RoundTripIntoPerformanceMirror()
    {
        var employee = CoreWorkforceContractFixture.Employee();
        var orgUnit = CoreWorkforceContractFixture.OrgUnit();

        Assert.Equal(CoreWorkforceContractFixture.EmployeeId, employee.EmployeeId);
        Assert.Equal("EMP-0001", employee.StableEmployeeKey);
        Assert.Equal("Alice Employee", employee.FullName);
        Assert.Equal(CoreWorkforceContractFixture.OrgUnitId, employee.OrgUnit?.OrgUnitId);
        Assert.Equal(CoreWorkforceContractFixture.ManagerId, employee.Manager?.EmployeeId);
        Assert.Equal(CoreWorkforceContractFixture.ManagerId, orgUnit.ResponsibleManagerEmployeeId);
    }

    [Fact]
    public async Task FakeCoreWorkforceClient_IsShapedFromTheContractFixture()
    {
        var fake = CoreWorkforceContractFixture.CreateFake();

        var resolved = await fake.ResolveEmployeesAsync(
            [CoreWorkforceContractFixture.EmployeeId], CancellationToken.None);
        var orgUnit = await fake.GetOrgUnitAsync(
            CoreWorkforceContractFixture.OrgUnitId, CancellationToken.None);

        Assert.Single(resolved);
        Assert.Equal("Alice Employee", resolved[0].DisplayName);
        Assert.Equal(CoreWorkforceContractFixture.ManagerId, orgUnit?.ResponsibleManagerEmployeeId);
    }
}
