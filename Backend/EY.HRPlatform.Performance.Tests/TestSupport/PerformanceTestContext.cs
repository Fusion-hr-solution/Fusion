using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>Helpers for building in-memory PerformanceDbContext instances with a resolved tenant.</summary>
public static class PerformanceTestContext
{
    /// <summary>
    /// Creates a context bound to a (optionally shared) named in-memory database. Pass the same
    /// <paramref name="databaseName"/> to a seed context and a separate execution context to mirror
    /// the request-per-context production lifecycle (and avoid InMemory rowversion tracking quirks).
    /// </summary>
    public static PerformanceDbContext Create(Guid tenantId, out TenantContext tenantContext, string? databaseName = null)
    {
        var tc = new TenantContext();
        tc.SetTenant(tenantId);
        tenantContext = tc;
        return Create(tc, databaseName);
    }

    public static PerformanceDbContext Create(ITenantContext tenantContext, string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(databaseName ?? $"performance-tests-{Guid.NewGuid()}")
            .Options;

        return new PerformanceDbContext(options, tenantContext);
    }
}

public sealed class StubCurrentUserContext : ICurrentUserContext
{
    public Guid? UserId { get; init; } = Guid.NewGuid();
    public Guid? EmployeeId { get; init; }
    public string? FullName { get; init; } = "Test Actor";
    public string? CorrelationId { get; init; } = "test-correlation-id";
}
