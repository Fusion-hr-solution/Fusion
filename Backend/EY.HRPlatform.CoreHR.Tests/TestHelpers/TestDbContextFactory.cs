using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.TestHelpers;

/// <summary>
/// Factory for creating CoreHRDbContext instances for testing.
/// Supports configurable tenant context and interceptor injection.
/// </summary>
public static class TestDbContextFactory
{
    /// <summary>
    /// Creates a DbContext with a specific tenant context (for testing tenant-scoped queries).
    /// </summary>
    public static CoreHRDbContext Create(
        ITenantContext tenantContext,
        string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<CoreHRDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options;

        return new CoreHRDbContext(options, tenantContext);
    }

    /// <summary>
    /// Creates a DbContext without tenant context (design-time mode, queries return no results).
    /// Useful for seeding test data without tenant filter interference.
    /// </summary>
    public static CoreHRDbContext CreateWithoutTenant(string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<CoreHRDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options;

        return new CoreHRDbContext(options);
    }

    /// <summary>
    /// Creates a DbContext with the TenantSaveChangesInterceptor attached.
    /// Use this when testing write-time tenant enforcement.
    /// </summary>
    public static CoreHRDbContext CreateWithInterceptor(
        ITenantContext tenantContext,
        string? databaseName = null)
    {
        var interceptor = new TenantSaveChangesInterceptor(tenantContext);
        var options = new DbContextOptionsBuilder<CoreHRDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .AddInterceptors(interceptor)
            .Options;

        return new CoreHRDbContext(options, tenantContext);
    }
}

/// <summary>
/// Simple ITenantContext implementation for testing.
/// Allows pre-setting tenant or leaving unresolved.
/// </summary>
public sealed class TestTenantContext : ITenantContext
{
    private readonly Guid? _tenantId;

    public TestTenantContext(Guid? tenantId = null)
    {
        _tenantId = tenantId;
    }

    public Guid TenantId => _tenantId ?? throw new InvalidOperationException("Tenant not resolved.");
    public bool IsResolved => _tenantId.HasValue;
    public Guid? TenantIdOrDefault => _tenantId;

    /// <summary>
    /// Creates a resolved tenant context with the specified tenant ID.
    /// </summary>
    public static TestTenantContext WithTenant(Guid tenantId) => new(tenantId);

    /// <summary>
    /// Creates an unresolved tenant context.
    /// </summary>
    public static TestTenantContext Unresolved() => new(null);
}
