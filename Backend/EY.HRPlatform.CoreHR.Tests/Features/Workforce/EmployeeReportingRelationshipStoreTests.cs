using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public class EmployeeReportingRelationshipStoreTests
{
    [Fact]
    public async Task ReportingRelationships_AreTenantIsolated()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var databaseName = Guid.NewGuid().ToString();

        await using (var seed = TestDbContextFactory.CreateWithoutTenant(databaseName))
        {
            seed.EmployeeReportingRelationships.AddRange(
            EmployeeReportingRelationship.Create(tenantA, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                    ReportingRelationshipType.PrimaryManager, DateTime.UtcNow),
            EmployeeReportingRelationship.Create(tenantB, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                    ReportingRelationshipType.PrimaryManager, DateTime.UtcNow));
            await seed.SaveChangesAsync();
        }

        await using var tenantAContext = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantA), databaseName);

        Assert.Single(await tenantAContext.EmployeeReportingRelationships.ToListAsync());
    }
}
