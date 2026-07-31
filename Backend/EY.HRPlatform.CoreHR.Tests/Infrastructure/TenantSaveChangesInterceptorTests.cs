using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Infrastructure;

public class TenantSaveChangesInterceptorTests
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    private static Employee CreateEmployee(Guid tenantId) =>
        Employee.Create(
            tenantId,
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow);

    [Fact]
    public async Task SaveChangesAsync_WithCorrectTenant_Succeeds()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantA);
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext);
        var employee = CreateEmployee(TenantA);

        // Act
        context.Employees.Add(employee);
        await context.SaveChangesAsync();

        // Assert
        var saved = await context.Employees.IgnoreQueryFilters().FirstOrDefaultAsync();
        Assert.NotNull(saved);
        Assert.Equal(TenantA, saved.TenantId);
    }

    [Fact]
    public async Task SaveChangesAsync_WithoutTenantContext_ThrowsTenantAccessDenied()
    {
        // Arrange
        var tenantContext = TestTenantContext.Unresolved();
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext);
        var employee = CreateEmployee(TenantA);

        // Act
        context.Employees.Add(employee);

        // Assert
        var exception = await Assert.ThrowsAsync<TenantAccessDeniedException>(
            () => context.SaveChangesAsync());
        Assert.Contains("without resolved tenant context", exception.Message);
    }

    [Fact]
    public async Task SaveChangesAsync_WithWrongTenant_ThrowsTenantAccessDenied()
    {
        // Arrange - entity has TenantA, but context is TenantB
        var tenantContext = TestTenantContext.WithTenant(TenantB);
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext);
        var employee = CreateEmployee(TenantA);

        // Act
        context.Employees.Add(employee);

        // Assert
        var exception = await Assert.ThrowsAsync<TenantAccessDeniedException>(
            () => context.SaveChangesAsync());
        Assert.Contains("different tenant", exception.Message);
    }

    [Fact]
    public async Task SaveChangesAsync_ModifyWithCorrectTenant_Succeeds()
    {
        // Arrange - seed data then modify
        var dbName = Guid.NewGuid().ToString();
        var employee = CreateEmployee(TenantA);

        // Seed with design-time context (no interceptor)
        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
        }

        // Act - modify with correct tenant
        var tenantContext = TestTenantContext.WithTenant(TenantA);
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext, dbName);
        var loaded = await context.Employees.IgnoreQueryFilters().FirstAsync();
        loaded.UpdateProfile("Jane", "Doe", "jane.doe@example.com", null, loaded.Phone);
        await context.SaveChangesAsync();

        // Assert
        var updated = await context.Employees.IgnoreQueryFilters().FirstAsync();
        Assert.Equal("Jane", updated.FirstName);
    }

    [Fact]
    public async Task SaveChangesAsync_ModifyWithWrongTenant_ThrowsTenantAccessDenied()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var employee = CreateEmployee(TenantA);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
        }

        // Act - try to modify with wrong tenant
        var tenantContext = TestTenantContext.WithTenant(TenantB);
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext, dbName);
        var loaded = await context.Employees.IgnoreQueryFilters().FirstAsync();
        loaded.UpdateProfile("Jane", "Doe", "jane.doe@example.com", null, loaded.Phone);

        // Assert
        var exception = await Assert.ThrowsAsync<TenantAccessDeniedException>(
            () => context.SaveChangesAsync());
        Assert.Contains("different tenant", exception.Message);
    }

    [Fact]
    public async Task SaveChangesAsync_DeleteWithCorrectTenant_Succeeds()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var employee = CreateEmployee(TenantA);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
        }

        // Act
        var tenantContext = TestTenantContext.WithTenant(TenantA);
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext, dbName);
        var loaded = await context.Employees.IgnoreQueryFilters().FirstAsync();
        context.Employees.Remove(loaded);
        await context.SaveChangesAsync();

        // Assert
        var remaining = await context.Employees.IgnoreQueryFilters().CountAsync();
        Assert.Equal(0, remaining);
    }

    [Fact]
    public async Task SaveChangesAsync_DeleteWithWrongTenant_ThrowsTenantAccessDenied()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var employee = CreateEmployee(TenantA);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
        }

        // Act
        var tenantContext = TestTenantContext.WithTenant(TenantB);
        await using var context = TestDbContextFactory.CreateWithInterceptor(tenantContext, dbName);
        var loaded = await context.Employees.IgnoreQueryFilters().FirstAsync();
        context.Employees.Remove(loaded);

        // Assert
        var exception = await Assert.ThrowsAsync<TenantAccessDeniedException>(
            () => context.SaveChangesAsync());
        Assert.Contains("different tenant", exception.Message);
    }

    [Fact]
    public async Task QueryFilter_ExcludesOtherTenantsEmployees()
    {
        // Arrange - create employees for two tenants
        var dbName = Guid.NewGuid().ToString();
        var employeeA = CreateEmployee(TenantA);
        var employeeB = Employee.Create(TenantB, "Bob", "Smith", "bob@example.com", DateTime.UtcNow);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.Employees.AddRange(employeeA, employeeB);
            await seedContext.SaveChangesAsync();
        }

        // Act - query with TenantA context
        var tenantContext = TestTenantContext.WithTenant(TenantA);
        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var employees = await context.Employees.ToListAsync();

        // Assert - only TenantA employee visible
        Assert.Single(employees);
        Assert.Equal(TenantA, employees[0].TenantId);
    }

    [Fact]
    public async Task QueryFilter_WithUnresolvedTenant_ReturnsEmpty()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var employee = CreateEmployee(TenantA);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
        }

        // Act - query without tenant (design-time mode)
        await using var context = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employees = await context.Employees.ToListAsync();

        // Assert - fail-closed: no results
        Assert.Empty(employees);
    }
}
