using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class PositionTests
{
    [Fact]
    public void Create_NormalizesCodeAndCapturesOwningOrgUnit()
    {
        var tenantId = Guid.NewGuid();
        var orgUnitId = Guid.NewGuid();

        var position = Position.Create(tenantId, " eng-001 ", " Backend Engineer ", orgUnitId);

        Assert.Equal(tenantId, position.TenantId);
        Assert.Equal("ENG-001", position.Code);
        Assert.Equal("Backend Engineer", position.Title);
        Assert.Equal(orgUnitId, position.OrgUnitId);
        Assert.True(position.IsActive);
    }
}
