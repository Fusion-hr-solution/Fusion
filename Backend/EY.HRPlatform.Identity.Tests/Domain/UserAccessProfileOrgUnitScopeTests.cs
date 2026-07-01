using EY.HRPlatform.Identity.Domain.Entities;

namespace EY.HRPlatform.Identity.Tests.Domain;

public sealed class UserAccessProfileOrgUnitScopeTests
{
    [Fact]
    public void Create_BindsScopeToOneTenantUserAndProfile()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var orgUnitId = Guid.NewGuid();

        var scope = UserAccessProfileOrgUnitScope.Create(tenantId, userId, profileId, orgUnitId);

        Assert.Equal(tenantId, scope.TenantId);
        Assert.Equal(userId, scope.UserId);
        Assert.Equal(profileId, scope.AccessProfileId);
        Assert.Equal(orgUnitId, scope.OrgUnitId);
    }

    [Fact]
    public void Create_RejectsEmptyOrgUnit()
    {
        Assert.Throws<ArgumentException>(() => UserAccessProfileOrgUnitScope.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.Empty));
    }
}
