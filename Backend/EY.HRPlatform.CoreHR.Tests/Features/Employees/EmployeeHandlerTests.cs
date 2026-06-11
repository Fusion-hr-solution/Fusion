using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.DeactivateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateOwnEmployeeProfile;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
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

        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow.AddDays(-30),
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
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
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
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
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
    public async Task CreateEmployee_WithInactiveManager_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var manager = Employee.Create(TenantId, "Manager", "Person", "manager@example.com", DateTime.UtcNow);
        manager.Deactivate();
        seedContext.Employees.Add(manager);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            ManagerId: manager.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("inactive employee as manager", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateEmployee_WithManagerFromDifferentTenant_ThrowsEntityNotFoundException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        var otherTenantId = Guid.NewGuid();

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var manager = Employee.Create(otherTenantId, "Manager", "Person", "manager@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(manager);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
        var command = new CreateEmployeeCommand(
            "John",
            "Doe",
            "john.doe@example.com",
            DateTime.UtcNow,
            ManagerId: manager.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("Manager", exception.Message);
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
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
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
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
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
        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
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

        var handler = new CreateEmployeeCommandHandler(context, tenantContext, new EmployeeHierarchyService(context));
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
        var handler = CreateGetEmployeeByIdHandler(context);
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
        var handler = CreateGetEmployeeByIdHandler(context);
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

        var handler = CreateGetEmployeeByIdHandler(context);
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
        var handler = CreateGetEmployeeByIdHandler(context);
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
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            "Jane",
            "Smith",
            "jane.smith@example.com",
            "Manager",
            null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Jane", result.Value.FirstName);
        Assert.Equal("Smith", result.Value.LastName);
        Assert.Equal("jane.smith@example.com", result.Value.Email);
        Assert.Equal("Manager", result.Value.JobTitle);
    }

    [Fact]
    public async Task UpdateEmployee_WhenNotExists_ThrowsEntityNotFoundException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);

        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            Guid.NewGuid(),
            0,
            "Jane",
            "Smith",
            "jane@example.com",
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
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));

        // Use a stale (incorrect) version - real version is 0, we pass 999
        var command = new UpdateEmployeeCommand(
            employee.Id,
            999, // Stale version
            "Jane",
            "Smith",
            "jane@example.com",
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
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));

        // Only update firstName, leave everything else null (unchanged)
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            "Jane",  // New first name
            null,    // Keep existing last name
            null,    // Keep existing email
            null,    // Keep existing job title
            null);   // Keep existing manager

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Jane", result.Value.FirstName);        // Changed
        Assert.Equal("Doe", result.Value.LastName);          // Preserved
        Assert.Equal("john@example.com", result.Value.Email); // Preserved
        Assert.Equal("Developer", result.Value.JobTitle);     // Preserved
    }

    [Fact]
    public async Task UpdateEmployee_WithHireDate_UpdatesHireDate()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        var originalHireDate = DateTime.UtcNow.AddYears(-2);
        var updatedHireDate = DateTime.UtcNow.AddYears(-1);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", originalHireDate);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            null,
            null,
            null,
            updatedHireDate);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(updatedHireDate, result.Value.HireDate);

        var saved = await context.Employees.IgnoreQueryFilters().FirstAsync(e => e.Id == employee.Id);
        Assert.Equal(updatedHireDate, saved.HireDate);
    }

    [Fact]
    public async Task UpdateEmployee_WithHireDateUsingUnspecifiedKind_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow.AddYears(-1));
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            null,
            null,
            null,
            new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Unspecified));

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("HireDate", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UpdateEmployee_WithBlankJobTitleWhenRequired_ThrowsArgumentException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await SeedTenantSettingsAsync(
            dbName,
            """
            {
                "employeeFieldConfig": {
                    "jobTitle": { "required": true }
                }
            }
            """);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow, null, "Developer");
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            "   ",
            null);

        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("Job title is required", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UpdateEmployee_AllowsUnrelatedUpdates_WhenRequiredJobTitleIsMissingButNotEdited()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await SeedTenantSettingsAsync(
            dbName,
            """
            {
                "employeeFieldConfig": {
                    "jobTitle": { "required": true }
                }
            }
            """);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            null,
            null,
            orgUnit.Id);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(orgUnit.Id, result.Value.OrgUnitId);
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
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
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
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
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

    [Fact]
    public async Task UpdateEmployee_WithInactiveOrgUnit_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        orgUnit.Deactivate();
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            version,
            null,
            null,
            null,
            null,
            null,
            orgUnit.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("inactive org unit", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UpdateEmployee_WhenManagerAssignmentWouldCreateCycle_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
        var report = Employee.Create(TenantId, "Sarah", "Report", "sarah.report@example.com", DateTime.UtcNow);
        report.AssignManager(manager.Id);
        seedContext.Employees.AddRange(manager, report);
        await seedContext.SaveChangesAsync();
        var managerVersion = manager.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            manager.Id,
            managerVersion,
            null,
            null,
            null,
            null,
            report.Id,
            null);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("cycle", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UpdateEmployee_WithInactiveManager_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        var inactiveManager = Employee.Create(TenantId, "Inactive", "Manager", "inactive.manager@example.com", DateTime.UtcNow);
        inactiveManager.Deactivate();
        seedContext.Employees.AddRange(employee, inactiveManager);
        await seedContext.SaveChangesAsync();
        var employeeVersion = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new UpdateEmployeeCommand(
            employee.Id,
            employeeVersion,
            null,
            null,
            null,
            null,
            inactiveManager.Id,
            null);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("inactive employee as manager", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    #endregion

    #region UpdateOwnEmployeeProfileCommandHandler Tests

    [Fact]
    public async Task UpdateOwnEmployeeProfile_WithPreferredName_UpdatesEmployee()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateOwnEmployeeProfileCommandHandler(context);

        var result = await handler.Handle(
            new UpdateOwnEmployeeProfileCommand(employee.Id, version, "Sally"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var updated = await context.Employees.IgnoreQueryFilters().FirstAsync(e => e.Id == employee.Id);
        Assert.Equal("Sally", updated.PreferredName);
    }

    [Fact]
    public async Task UpdateOwnEmployeeProfile_WithWhitespacePreferredName_ClearsValue()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
        employee.UpdatePreferredName("Sally");
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();
        var version = employee.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateOwnEmployeeProfileCommandHandler(context);

        var result = await handler.Handle(
            new UpdateOwnEmployeeProfileCommand(employee.Id, version, "   "),
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var updated = await context.Employees.IgnoreQueryFilters().FirstAsync(e => e.Id == employee.Id);
        Assert.Null(updated.PreferredName);
    }

    [Fact]
    public async Task UpdateOwnEmployeeProfile_WithStaleVersion_ThrowsConcurrencyException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var employee = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateOwnEmployeeProfileCommandHandler(context);

        await Assert.ThrowsAsync<ConcurrencyException>(() =>
            handler.Handle(
                new UpdateOwnEmployeeProfileCommand(employee.Id, 999, "Sally"),
                CancellationToken.None));
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
        var handler = new DeactivateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
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

        var handler = new DeactivateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
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
        var handler = new DeactivateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));

        // Use a stale version
        var command = new DeactivateEmployeeCommand(employee.Id, 999);

        // Act & Assert
        await Assert.ThrowsAsync<ConcurrencyException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task DeactivateEmployee_WithActiveDirectReports_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
        var report = Employee.Create(TenantId, "Sarah", "Report", "sarah.report@example.com", DateTime.UtcNow);
        report.AssignManager(manager.Id);
        seedContext.Employees.AddRange(manager, report);
        await seedContext.SaveChangesAsync();
        var managerVersion = manager.Version;

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new DeactivateEmployeeCommandHandler(context, new EmployeeHierarchyService(context));
        var command = new DeactivateEmployeeCommand(manager.Id, managerVersion);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("direct reports", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    #endregion

    private static GetEmployeeByIdQueryHandler CreateGetEmployeeByIdHandler(CoreHRDbContext context)
        => new(context, new EmployeeReadModelPolicy(), new TenantSettingsReadService(context));

    private static async Task SeedTenantSettingsAsync(string dbName, string overridesJson)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        seedContext.TenantSettings.Add(EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings.Create(TenantId, overridesJson));
        await seedContext.SaveChangesAsync();
    }
}
