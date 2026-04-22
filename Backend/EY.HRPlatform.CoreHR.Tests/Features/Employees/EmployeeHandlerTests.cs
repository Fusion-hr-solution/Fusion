using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.DeactivateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeeHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    #region CreateEmployeeCommandHandler Tests

    [Fact]
    public async Task CreateEmployee_WithValidData_ReturnsCreatedEmployee()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);

        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow.AddDays(-30),
            "Engineering",
            "Developer");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("John", result.Value.FirstName);
        Assert.Equal("Doe", result.Value.LastName);
        Assert.Equal("john.doe@example.com", result.Value.Email);
        Assert.Equal(TenantId, result.Value.TenantId);
        Assert.Equal(EmployeeStatus.Active, result.Value.Status);

        // Verify persisted
        var saved = await context.Employees.IgnoreQueryFilters().FirstOrDefaultAsync();
        Assert.NotNull(saved);
        Assert.Equal(result.Value.Id, saved.Id);
    }

    [Fact]
    public async Task CreateEmployee_WithDuplicateEmail_ThrowsDuplicateEntityException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var existing = Employee.Create(TenantId, "Jane", "Doe", "john.doe@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(existing);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com", // Duplicate email
            DateTime.UtcNow);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<DuplicateEntityException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("email", exception.Message);
    }

    [Fact]
    public async Task CreateEmployee_WithManager_AssignsManagerCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed a manager
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var manager = Employee.Create(TenantId, "Manager", "Person", "manager@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(manager);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            ManagerId: manager.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(manager.Id, result.Value.ManagerId);
        Assert.NotNull(result.Value.Manager);
        Assert.Equal("Manager", result.Value.Manager.FirstName);
    }

    [Fact]
    public async Task CreateEmployee_WithOrgUnit_AssignsOrgUnitCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        seedContext.OrgUnits.Add(orgUnit);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            OrgUnitId: orgUnit.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(orgUnit.Id, result.Value.OrgUnitId);
        Assert.Equal("Engineering", result.Value.OrgUnitName);

        var saved = await context.Employees.IgnoreQueryFilters().FirstAsync(e => e.Id == result.Value.Id);
        Assert.Equal(orgUnit.Id, saved.OrgUnitId);
    }

    [Fact]
    public async Task CreateEmployee_WithInactiveOrgUnit_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        orgUnit.Deactivate();
        seedContext.OrgUnits.Add(orgUnit);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            OrgUnitId: orgUnit.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("inactive org unit", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateEmployee_WithOrgUnitFromDifferentTenant_ThrowsEntityNotFoundException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        var otherTenantId = Guid.NewGuid();

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(otherTenantId, "ENG", "Engineering", "Department", null);
        seedContext.OrgUnits.Add(orgUnit);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            OrgUnitId: orgUnit.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("OrgUnit", exception.Message);
    }

    [Fact]
    public async Task CreateEmployee_WithNonExistentManager_ThrowsEntityNotFoundException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);

        var handler = new CreateEmployeeCommandHandler(context, tenantContext);
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            ManagerId: Guid.NewGuid()); // Non-existent manager

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("Manager", exception.Message);
    }

    #endregion

    #region GetEmployeeByIdQueryHandler Tests

    [Fact]
    public async Task GetEmployeeById_WhenExists_ReturnsEmployee()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetEmployeeByIdQueryHandler(context);
        var query = new GetEmployeeByIdQuery(employee.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(employee.Id, result.Value.Id);
        Assert.Equal("John", result.Value.FirstName);
    }

    [Fact]
    public async Task GetEmployeeById_WhenEmployeeHasOrgUnit_ReturnsOrgUnitLinkage()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        seedContext.OrgUnits.Add(orgUnit);

        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        employee.AssignOrgUnit(orgUnit.Id);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetEmployeeByIdQueryHandler(context);
        var query = new GetEmployeeByIdQuery(employee.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(orgUnit.Id, result.Value.OrgUnitId);
        Assert.Equal("Engineering", result.Value.OrgUnitName);
    }

    [Fact]
    public async Task GetEmployeeById_WhenNotExists_ReturnsFailure()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);

        var handler = new GetEmployeeByIdQueryHandler(context);
        var query = new GetEmployeeByIdQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetEmployeeById_FromDifferentTenant_ReturnsFailure()
    {
        // Arrange - employee in TenantA, query from TenantB
        var dbName = Guid.NewGuid().ToString();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(tenantA, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        var tenantContext = TestTenantContext.WithTenant(tenantB); // Different tenant
        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetEmployeeByIdQueryHandler(context);
        var query = new GetEmployeeByIdQuery(employee.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert - should not find due to tenant filter
        Assert.True(result.IsFailure);
    }

    #endregion

    #region UpdateEmployeeCommandHandler Tests

    [Fact]
    public async Task UpdateEmployee_WithValidData_UpdatesEmployee()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context);
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            "Jane",
            "Smith",
            "jane.smith@example.com",
            "HR",
            "Manager",
            null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Jane", result.Value.FirstName);
        Assert.Equal("Smith", result.Value.LastName);
        Assert.Equal("jane.smith@example.com", result.Value.Email);
        Assert.Equal("HR", result.Value.Department);
    }

    [Fact]
    public async Task UpdateEmployee_WhenNotExists_ThrowsEntityNotFoundException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);

        var handler = new UpdateEmployeeCommandHandler(context);
        var command = new UpdateEmployeeCommand(
            Guid.NewGuid(),
            0,
            "Jane",
            "Smith",
            "jane@example.com",
            null,
            null,
            null);

        // Act & Assert
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateEmployee_WithStaleVersion_ThrowsConcurrencyException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context);

        // Use a stale (incorrect) version - real version is 0, we pass 999
        var command = new UpdateEmployeeCommand(
            employee.Id,
            999, // Stale version
            "Jane",
            "Smith",
            "jane@example.com",
            null,
            null,
            null);

        // Act & Assert
        await Assert.ThrowsAsync<ConcurrencyException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateEmployee_PartialUpdate_OnlyChangesProvidedFields()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow, "Engineering", "Developer");
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context);

        // Only update firstName, leave everything else null (unchanged)
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            "Jane",  // New first name
            null,    // Keep existing last name
            null,    // Keep existing email
            null,    // Keep existing department
            null,    // Keep existing job title
            null);   // Keep existing manager

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Jane", result.Value.FirstName);        // Changed
        Assert.Equal("Doe", result.Value.LastName);          // Preserved
        Assert.Equal("john@example.com", result.Value.Email); // Preserved
        Assert.Equal("Engineering", result.Value.Department); // Preserved
        Assert.Equal("Developer", result.Value.JobTitle);     // Preserved
    }

    [Fact]
    public async Task UpdateEmployee_WithOrgUnit_AssignsOrgUnitCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context);
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            null,
            null,
            null,
            orgUnit.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(orgUnit.Id, result.Value.OrgUnitId);
        Assert.Equal("Engineering", result.Value.OrgUnitName);
    }

    [Fact]
    public async Task UpdateEmployee_WithEmptyOrgUnitId_ClearsOrgUnit()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        employee.AssignOrgUnit(orgUnit.Id);
        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context);
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            null,
            null,
            null,
            Guid.Empty);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.OrgUnitId);
        Assert.Null(result.Value.OrgUnitName);
    }

    #endregion

    #region DeactivateEmployeeCommandHandler Tests

    [Fact]
    public async Task DeactivateEmployee_WhenActive_DeactivatesSuccessfully()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new DeactivateEmployeeCommandHandler(context);
        var command = new DeactivateEmployeeCommand(employee.Id, version);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var updated = await context.Employees.IgnoreQueryFilters().FirstAsync(e => e.Id == employee.Id);
        Assert.Equal(EmployeeStatus.Inactive, updated.Status);
    }

    [Fact]
    public async Task DeactivateEmployee_WhenNotExists_ThrowsEntityNotFoundException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);

        var handler = new DeactivateEmployeeCommandHandler(context);
        var command = new DeactivateEmployeeCommand(Guid.NewGuid(), 0);

        // Act & Assert
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task DeactivateEmployee_WithStaleVersion_ThrowsConcurrencyException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new DeactivateEmployeeCommandHandler(context);

        // Use a stale version
        var command = new DeactivateEmployeeCommand(employee.Id, 999);

        // Act & Assert
        await Assert.ThrowsAsync<ConcurrencyException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    #endregion
}
