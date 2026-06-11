using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class GetEmployeesQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    #region Pagination Tests

    [Fact]
    public async Task GetEmployees_WithDefaultPagination_ReturnsFirstPage()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        // Seed 25 employees
        for (var i = 1; i <= 25; i++)
        {
            seedContext.Employees.Add(
                Employee.Create(TenantId, $"First{i}", $"Last{i}", $"user{i}@example.com", DateTime.UtcNow));
        }
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(25, result.Value.TotalCount);
        Assert.Equal(20, result.Value.Items.Count); // Default page size
        Assert.Equal(1, result.Value.Page);
        Assert.Equal(20, result.Value.PageSize);
        Assert.Equal(2, result.Value.TotalPages);
        Assert.True(result.Value.HasNextPage);
        Assert.False(result.Value.HasPreviousPage);
    }

    [Fact]
    public async Task GetEmployees_WithCustomPagination_ReturnsCorrectPage()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        for (var i = 1; i <= 15; i++)
        {
            seedContext.Employees.Add(
                Employee.Create(TenantId, $"First{i}", $"Last{i}", $"user{i}@example.com", DateTime.UtcNow));
        }
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Page: 2, PageSize: 5);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(15, result.Value.TotalCount);
        Assert.Equal(5, result.Value.Items.Count);
        Assert.Equal(2, result.Value.Page);
        Assert.Equal(5, result.Value.PageSize);
        Assert.Equal(3, result.Value.TotalPages);
        Assert.True(result.Value.HasNextPage);
        Assert.True(result.Value.HasPreviousPage);
    }

    [Fact]
    public async Task GetEmployees_WithNoEmployees_ReturnsEmptyList()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value.TotalCount);
        Assert.Empty(result.Value.Items);
        Assert.Equal(1, result.Value.Page);
        Assert.Equal(0, result.Value.TotalPages);
        Assert.False(result.Value.HasNextPage);
        Assert.False(result.Value.HasPreviousPage);
    }

    [Fact]
    public async Task GetEmployees_PageSizeExceedsMax_ClampedTo100()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(PageSize: 500);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(100, result.Value.PageSize); // Clamped to max
    }

    [Fact]
    public async Task GetEmployees_NegativePage_ClampedToOne()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Page: -5);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.Page);
    }

    #endregion

    #region Search Tests

    [Fact]
    public async Task GetEmployees_SearchByFirstName_FiltersCaseInsensitive()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Jane", "Smith", "jane@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Johnny", "Appleseed", "johnny@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Search: "john");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
        Assert.All(result.Value.Items, e =>
            Assert.Contains("john", e.FirstName, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetEmployees_SearchByLastName_FiltersCaseInsensitive()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "SMITH", "john@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Jane", "Smith", "jane@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Bob", "Jones", "bob@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Search: "smith");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
    }

    [Fact]
    public async Task GetEmployees_SearchByEmail_FiltersCaseInsensitive()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "Doe", "john.doe@acme.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Jane", "Smith", "jane@other.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Bob", "Jones", "bob@acme.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Search: "acme");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
    }

    [Fact]
    public async Task GetEmployees_SearchByFullName_FindsMatches()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Jane", "Smith", "jane@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Search: "john doe");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal("John", result.Value.Items[0].FirstName);
        Assert.Equal("Doe", result.Value.Items[0].LastName);
    }

    [Fact]
    public async Task GetEmployees_SearchWithNoMatches_ReturnsEmpty()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Search: "xyz123");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Items);
    }

    #endregion

    #region Filter Tests

    [Fact]
    public async Task GetEmployees_FilterByStatusActive_ReturnsOnlyActiveEmployees()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var activeEmployee = Employee.Create(TenantId, "Active", "Employee", "active@example.com", DateTime.UtcNow);
        var inactiveEmployee = Employee.Create(TenantId, "Inactive", "Employee", "inactive@example.com", DateTime.UtcNow);
        inactiveEmployee.Deactivate();

        seedContext.Employees.AddRange(activeEmployee, inactiveEmployee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Status: EmployeeStatus.Active);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(EmployeeStatus.Active, result.Value.Items[0].Status);
    }

    [Fact]
    public async Task GetEmployees_FilterByStatusInactive_ReturnsOnlyInactiveEmployees()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var activeEmployee = Employee.Create(TenantId, "Active", "Employee", "active@example.com", DateTime.UtcNow);
        var inactiveEmployee = Employee.Create(TenantId, "Inactive", "Employee", "inactive@example.com", DateTime.UtcNow);
        inactiveEmployee.Deactivate();

        seedContext.Employees.AddRange(activeEmployee, inactiveEmployee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Status: EmployeeStatus.Inactive);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(EmployeeStatus.Inactive, result.Value.Items[0].Status);
    }

    [Fact]
    public async Task GetEmployees_FilterByAccessNotInvited_ReturnsOnlyUnprovisionedEmployees()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var invited = Employee.Create(TenantId, "Invited", "User", "invited@example.com", DateTime.UtcNow);
        var notInvited = Employee.Create(TenantId, "Not", "Invited", "not-invited@example.com", DateTime.UtcNow);

        seedContext.Employees.AddRange(invited, notInvited);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(
            context,
            new StaticWorkforceAccountStatusReader(new Dictionary<Guid, WorkforceAccountStatusDto>
            {
                [invited.Id] = new(
                    EmployeeId: invited.Id,
                    Email: invited.Email,
                    FullName: null,
                    Role: "Employee",
                    AccessProfiles: [new WorkforceAccountAccessProfileDto(Guid.NewGuid(), "Employee", "SystemSeeded", true)],
                    ProvisioningState: "InvitePending",
                    UserId: null,
                    IsActive: false,
                    LastLoginAt: null,
                    InviteId: Guid.NewGuid(),
                    InviteCreatedAt: null,
                    InviteExpiresAt: null,
                    InviteLink: "http://localhost/invite/accept?token=1",
                    DeliveryStatus: null,
                    DeliveryMessage: null,
                    DeliveryRecordedAt: null,
                    Conflict: null)
            }));

        var result = await handler.Handle(new GetEmployeesQuery(Access: EmployeeAccessFilter.NotInvited), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var item = Assert.Single(result.Value.Items);
        Assert.Equal(notInvited.Id, item.Id);
    }

    [Fact]
    public async Task GetEmployees_FilterByAccessNeedsReview_ReturnsOnlyNeedsReviewStates()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var active = Employee.Create(TenantId, "Active", "User", "active@example.com", DateTime.UtcNow);
        var inactive = Employee.Create(TenantId, "Inactive", "User", "inactive@example.com", DateTime.UtcNow);
        var conflict = Employee.Create(TenantId, "Conflict", "User", "conflict@example.com", DateTime.UtcNow);

        seedContext.Employees.AddRange(active, inactive, conflict);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(
            context,
            new StaticWorkforceAccountStatusReader(new Dictionary<Guid, WorkforceAccountStatusDto>
            {
                [active.Id] = new(
                    EmployeeId: active.Id,
                    Email: active.Email,
                    FullName: null,
                    Role: "Employee",
                    AccessProfiles: [new WorkforceAccountAccessProfileDto(Guid.NewGuid(), "Employee", "SystemSeeded", true)],
                    ProvisioningState: "Active",
                    UserId: Guid.NewGuid(),
                    IsActive: true,
                    LastLoginAt: null,
                    InviteId: null,
                    InviteCreatedAt: null,
                    InviteExpiresAt: null,
                    InviteLink: null,
                    DeliveryStatus: null,
                    DeliveryMessage: null,
                    DeliveryRecordedAt: null,
                    Conflict: null),
                [inactive.Id] = new(
                    EmployeeId: inactive.Id,
                    Email: inactive.Email,
                    FullName: null,
                    Role: "Employee",
                    AccessProfiles: [new WorkforceAccountAccessProfileDto(Guid.NewGuid(), "Employee", "SystemSeeded", true)],
                    ProvisioningState: "Inactive",
                    UserId: Guid.NewGuid(),
                    IsActive: false,
                    LastLoginAt: null,
                    InviteId: null,
                    InviteCreatedAt: null,
                    InviteExpiresAt: null,
                    InviteLink: null,
                    DeliveryStatus: null,
                    DeliveryMessage: null,
                    DeliveryRecordedAt: null,
                    Conflict: null),
                [conflict.Id] = new(
                    EmployeeId: conflict.Id,
                    Email: conflict.Email,
                    FullName: null,
                    Role: "Employee",
                    AccessProfiles: [],
                    ProvisioningState: "Conflict",
                    UserId: null,
                    IsActive: false,
                    LastLoginAt: null,
                    InviteId: null,
                    InviteCreatedAt: null,
                    InviteExpiresAt: null,
                    InviteLink: null,
                    DeliveryStatus: null,
                    DeliveryMessage: null,
                    DeliveryRecordedAt: null,
                    Conflict: new WorkforceAccountConflictDto(
                        "EmailAlreadyRegistered",
                        "This email is already linked to another account.",
                        true,
                        "Check the existing account before sending a new invitation."))
            }));

        var result = await handler.Handle(new GetEmployeesQuery(Access: EmployeeAccessFilter.NeedsReview), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Items.Count);
        Assert.Contains(result.Value.Items, item => item.Id == inactive.Id);
        Assert.Contains(result.Value.Items, item => item.Id == conflict.Id);
    }

    [Fact]
    public async Task GetEmployees_CombinedSearchAndStatus_AppliesBoth()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow));
        var inactiveJohn = Employee.Create(TenantId, "John", "Smith", "johns@example.com", DateTime.UtcNow);
        inactiveJohn.Deactivate();
        seedContext.Employees.Add(inactiveJohn);
        seedContext.Employees.Add(Employee.Create(TenantId, "Jane", "Doe", "jane@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(Search: "john", Status: EmployeeStatus.Active);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal("John", result.Value.Items[0].FirstName);
        Assert.Equal(EmployeeStatus.Active, result.Value.Items[0].Status);
    }

    #endregion

    #region Sorting Tests

    [Fact]
    public async Task GetEmployees_SortByNameAscending_SortsByLastNameThenFirstName()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "Zach", "Adams", "zach@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Alice", "Brown", "alice@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Bob", "Adams", "bob@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(SortBy: EmployeeSortField.Name, SortDir: SortDirection.Asc);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Items.Count);
        Assert.Equal("Bob", result.Value.Items[0].FirstName);   // Adams, Bob
        Assert.Equal("Zach", result.Value.Items[1].FirstName);  // Adams, Zach
        Assert.Equal("Alice", result.Value.Items[2].FirstName); // Brown, Alice
    }

    [Fact]
    public async Task GetEmployees_SortByNameDescending_ReversesOrder()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "Alice", "Adams", "alice@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Bob", "Zeta", "bob@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(SortBy: EmployeeSortField.Name, SortDir: SortDirection.Desc);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Bob", result.Value.Items[0].FirstName);   // Zeta first in desc
        Assert.Equal("Alice", result.Value.Items[1].FirstName); // Adams second
    }

    [Fact]
    public async Task GetEmployees_SortByEmail_SortsCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "John", "Doe", "zebra@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Jane", "Smith", "alpha@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(SortBy: EmployeeSortField.Email, SortDir: SortDirection.Asc);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("alpha@example.com", result.Value.Items[0].Email);
        Assert.Equal("zebra@example.com", result.Value.Items[1].Email);
    }

    [Fact]
    public async Task GetEmployees_SortByHireDate_SortsCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "Newer", "Employee", "newer@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(TenantId, "Older", "Employee", "older@example.com", DateTime.UtcNow.AddYears(-5)));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery(SortBy: EmployeeSortField.HireDate, SortDir: SortDirection.Asc);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Older", result.Value.Items[0].FirstName);  // Hired 5 years ago
        Assert.Equal("Newer", result.Value.Items[1].FirstName);  // Hired today
    }

    #endregion

    #region Tenant Isolation Tests

    [Fact]
    public async Task GetEmployees_OnlyReturnsEmployeesFromCurrentTenant()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(tenantA, "TenantA", "Employee", "a@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(tenantB, "TenantB", "Employee", "b@example.com", DateTime.UtcNow));
        seedContext.Employees.Add(Employee.Create(tenantA, "TenantA2", "Employee", "a2@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        var tenantContext = TestTenantContext.WithTenant(tenantA);
        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
        Assert.All(result.Value.Items, e =>
            Assert.StartsWith("TenantA", e.FirstName));
    }

    #endregion

    #region Manager Info Tests

    [Fact]
    public async Task GetEmployees_IncludesManagerName()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var manager = Employee.Create(TenantId, "Manager", "Person", "manager@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(manager);
        await seedContext.SaveChangesAsync();

        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        employee.AssignManager(manager.Id);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        var johnDoe = result.Value.Items.First(e => e.FirstName == "John");
        Assert.Equal(manager.Id, johnDoe.ManagerId);
        Assert.Equal("Manager Person", johnDoe.ManagerName);
        Assert.Equal(EmployeeHierarchyStatuses.Healthy, johnDoe.HierarchyStatus);
    }

    [Fact]
    public async Task GetEmployees_WithoutManager_ManagerNameIsNull()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.Employees.Add(Employee.Create(TenantId, "Solo", "Employee", "solo@example.com", DateTime.UtcNow));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Null(result.Value.Items[0].ManagerId);
        Assert.Null(result.Value.Items[0].ManagerName);
        Assert.Equal(EmployeeHierarchyStatuses.NoManagerAssigned, result.Value.Items[0].HierarchyStatus);
    }

    [Fact]
    public async Task GetEmployees_TopLevelLeaderWithDirectReports_ReturnsRootStatus()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var leader = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
        var directReport = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
        directReport.AssignManager(leader.Id);

        seedContext.Employees.AddRange(leader, directReport);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var leaderItem = result.Value.Items.Single(item => item.Id == leader.Id);
        Assert.Equal(EmployeeHierarchyStatuses.Root, leaderItem.HierarchyStatus);
        Assert.Equal(1, leaderItem.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployees_IncludesDirectReportCount()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
        var reportOne = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
        var reportTwo = Employee.Create(TenantId, "Jordan", "Ray", "jordan.ray@example.com", DateTime.UtcNow);
        reportOne.AssignManager(manager.Id);
        reportTwo.AssignManager(manager.Id);
        seedContext.Employees.AddRange(manager, reportOne, reportTwo);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var managerItem = result.Value.Items.First(item => item.Id == manager.Id);
        Assert.Equal(2, managerItem.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployees_WithMissingManager_SurfacesManagerMissingStatus()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        employee.AssignManager(Guid.Parse("99999999-9999-9999-9999-999999999999"));
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(EmployeeHierarchyStatuses.ManagerMissing, result.Value.Items[0].HierarchyStatus);
    }

    [Fact]
    public async Task GetEmployees_IncludesOrgUnitLinkage()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        seedContext.OrgUnits.Add(orgUnit);
        await seedContext.SaveChangesAsync();

        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com", DateTime.UtcNow);
        employee.AssignOrgUnit(orgUnit.Id);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);
        var query = new GetEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(orgUnit.Id, result.Value.Items[0].OrgUnitId);
        Assert.Equal("Engineering", result.Value.Items[0].OrgUnitName);
    }

    [Fact]
    public async Task GetEmployees_WithOrgUnitFilter_ReturnsOnlyEmployeesInSelectedOrgUnit()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var engineering = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var finance = OrgUnit.Create(TenantId, "FIN", "Finance", "Department", null);

        var engineer = Employee.Create(TenantId, "Jordan", "Engineer", "jordan.engineer@example.com", DateTime.UtcNow);
        engineer.AssignOrgUnit(engineering.Id);

        var analyst = Employee.Create(TenantId, "Taylor", "Analyst", "taylor.analyst@example.com", DateTime.UtcNow);
        analyst.AssignOrgUnit(finance.Id);

        var unassigned = Employee.Create(TenantId, "Casey", "Unassigned", "casey.unassigned@example.com", DateTime.UtcNow);

        seedContext.OrgUnits.AddRange(engineering, finance);
        seedContext.Employees.AddRange(engineer, analyst, unassigned);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeesQuery(OrgUnitId: engineering.Id),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var item = Assert.Single(result.Value.Items);
        Assert.Equal(engineer.Id, item.Id);
        Assert.Equal(engineering.Id, item.OrgUnitId);
    }

    [Fact]
    public async Task GetEmployees_WithManagerFilter_ReturnsOnlyDirectReportsForSelectedManager()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
        var otherManager = Employee.Create(TenantId, "Morgan", "Lead", "morgan.lead@example.com", DateTime.UtcNow);

        var firstReport = Employee.Create(TenantId, "Sam", "Report", "sam.report@example.com", DateTime.UtcNow);
        firstReport.AssignManager(manager.Id);

        var secondReport = Employee.Create(TenantId, "Jamie", "Report", "jamie.report@example.com", DateTime.UtcNow);
        secondReport.AssignManager(manager.Id);

        var otherReport = Employee.Create(TenantId, "Riley", "Peer", "riley.peer@example.com", DateTime.UtcNow);
        otherReport.AssignManager(otherManager.Id);

        var rootLeader = Employee.Create(TenantId, "Dana", "Root", "dana.root@example.com", DateTime.UtcNow);

        seedContext.Employees.AddRange(manager, otherManager, firstReport, secondReport, otherReport, rootLeader);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeesQuery(ManagerId: manager.Id),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
        Assert.All(result.Value.Items, item => Assert.Equal(manager.Id, item.ManagerId));
        Assert.Contains(result.Value.Items, item => item.Id == firstReport.Id);
        Assert.Contains(result.Value.Items, item => item.Id == secondReport.Id);
    }

    [Fact]
    public async Task GetEmployees_HidesJobTitle_WhenTenantSettingsDisableItForHrAdmin()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.TenantSettings.Add(EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings.Create(
            TenantId,
            """{"employeeFieldConfig":{"jobTitle":{"visible":false}}}"""));
        seedContext.Employees.Add(Employee.Create(TenantId, "Sarah", "Chen", "sarah@example.com", DateTime.UtcNow, null, "Senior Engineer"));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        // Act
        var result = await handler.Handle(new GetEmployeesQuery(), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Null(result.Value.Items[0].JobTitle);
    }

    [Fact]
    public async Task GetEmployees_WhenIssuesExist_SurfacesReadinessIssuesAndFixTargets()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        seedContext.TenantSettings.Add(EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings.Create(
            TenantId,
            """{"employeeFieldConfig":{"jobTitle":{"visible":true,"required":true,"visibleToEmployee":true,"visibleToManager":true}}}"""));

        var employee = Employee.Create(TenantId, "Jordan", "Solo", "jordan.solo@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var readiness = Assert.Single(result.Value.Items).Readiness;
        Assert.Equal(3, readiness.EmployeeStateIssueCount);
        Assert.Equal(0, readiness.BlockingIssueCount);

        var missingJobTitle = Assert.Single(readiness.EmployeeStateIssues, issue => issue.FieldKey == "jobTitle");
        Assert.Equal(EmployeeReadinessIssueCodes.MissingRequiredField, missingJobTitle.Code);
        Assert.Equal(EmployeeReadinessFixTargetKinds.ProfileEmployment, missingJobTitle.FixTarget.Kind);
        Assert.Equal(employee.Id, missingJobTitle.FixTarget.EmployeeId);

        var missingOrgUnit = Assert.Single(readiness.EmployeeStateIssues, issue => issue.Code == EmployeeReadinessIssueCodes.MissingOrgUnit);
        Assert.Equal(EmployeeReadinessFixTargetKinds.ProfileOrganization, missingOrgUnit.FixTarget.Kind);

        var missingManager = Assert.Single(readiness.EmployeeStateIssues, issue => issue.Code == EmployeeReadinessIssueCodes.NoManagerAssigned);
        Assert.Equal(EmployeeReadinessFixTargetKinds.ReportingRelationships, missingManager.FixTarget.Kind);
    }

    [Fact]
    public async Task GetEmployees_WithMissingOrgUnitReadinessFilter_ReturnsOnlyMatchingEmployees()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var cleanEmployee = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, null, "Engineer");
        cleanEmployee.AssignOrgUnit(orgUnit.Id);
        var missingOrgUnit = Employee.Create(TenantId, "Jordan", "Solo", "jordan.solo@example.com", DateTime.UtcNow, null, "Analyst");

        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.AddRange(cleanEmployee, missingOrgUnit);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeesQuery(Readiness: EmployeeReadinessFilter.MissingOrgUnit),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var item = Assert.Single(result.Value.Items);
        Assert.Equal(missingOrgUnit.Id, item.Id);
        Assert.Contains(item.Readiness.EmployeeStateIssues, issue => issue.Code == EmployeeReadinessIssueCodes.MissingOrgUnit);
    }

    [Fact]
    public async Task GetEmployees_WithNeedsAttentionReadinessFilter_ExcludesDeactivationOnlyBlockers()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, null, "Manager");
        manager.AssignOrgUnit(orgUnit.Id);
        var report = Employee.Create(TenantId, "Casey", "Report", "casey.report@example.com", DateTime.UtcNow, null, "Engineer");
        report.AssignManager(manager.Id);
        report.AssignOrgUnit(orgUnit.Id);
        var missingOrgUnit = Employee.Create(TenantId, "Jordan", "Solo", "jordan.solo@example.com", DateTime.UtcNow, null, "Analyst");

        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.AddRange(manager, report, missingOrgUnit);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeesQuery(Readiness: EmployeeReadinessFilter.NeedsAttention),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var item = Assert.Single(result.Value.Items);
        Assert.Equal(missingOrgUnit.Id, item.Id);
        Assert.DoesNotContain(result.Value.Items, employee => employee.Id == manager.Id);
    }

    [Fact]
    public async Task GetEmployees_WithDeactivationBlockedReadinessFilter_ReturnsManagersWithActiveReports()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var orgUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, null, "Manager");
        manager.AssignOrgUnit(orgUnit.Id);
        var report = Employee.Create(TenantId, "Casey", "Report", "casey.report@example.com", DateTime.UtcNow, null, "Engineer");
        report.AssignManager(manager.Id);
        report.AssignOrgUnit(orgUnit.Id);

        var individualContributor = Employee.Create(TenantId, "Taylor", "Solo", "taylor.solo@example.com", DateTime.UtcNow, null, "Engineer");
        individualContributor.AssignOrgUnit(orgUnit.Id);

        seedContext.OrgUnits.Add(orgUnit);
        seedContext.Employees.AddRange(manager, report, individualContributor);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeesQuery(Readiness: EmployeeReadinessFilter.DeactivationBlocked),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var item = Assert.Single(result.Value.Items);
        Assert.Equal(manager.Id, item.Id);
        Assert.Contains(item.Readiness.BlockingIssues, issue => issue.Code == EmployeeReadinessIssueCodes.DeactivationBlocked);
    }

    #endregion

    private static GetEmployeesQueryHandler CreateHandler(
        CoreHRDbContext context,
        IWorkforceAccountStatusReader? workforceAccountStatusReader = null)
        => new(
            context,
            new EmployeeReadModelPolicy(),
            new TenantSettingsReadService(context),
            workforceAccountStatusReader ?? new StaticWorkforceAccountStatusReader(new Dictionary<Guid, WorkforceAccountStatusDto>()));

    private sealed class StaticWorkforceAccountStatusReader(
        IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> statuses) : IWorkforceAccountStatusReader
    {
        public Task<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>> GetStatusesAsync(
            IReadOnlyCollection<WorkforceAccountSubjectDto> subjects,
            CancellationToken cancellationToken)
        {
            var result = statuses
                .Where(entry => subjects.Any(subject => subject.EmployeeId == entry.Key))
                .ToDictionary(entry => entry.Key, entry => entry.Value);

            return Task.FromResult<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>>(result);
        }
    }
}
