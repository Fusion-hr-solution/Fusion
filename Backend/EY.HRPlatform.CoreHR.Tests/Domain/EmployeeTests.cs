using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class EmployeeTests
{
    private static readonly Guid ValidTenantId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidInputs_ReturnsEmployee()
    {
        // Arrange
        var hireDate = DateTime.UtcNow.AddDays(-30);

        // Act
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john.doe@example.com",
            hireDate,
            "Engineering",
            "Software Engineer");

        // Assert
        Assert.Equal(ValidTenantId, employee.TenantId);
        Assert.Equal("John", employee.FirstName);
        Assert.Equal("Doe", employee.LastName);
        Assert.Equal("john.doe@example.com", employee.Email);
        Assert.Equal("Engineering", employee.Department);
        Assert.Equal("Software Engineer", employee.JobTitle);
        Assert.Equal(hireDate, employee.HireDate);
        Assert.Equal(EmployeeStatus.Active, employee.Status);
        Assert.Null(employee.ManagerId);
    }

    [Fact]
    public void Create_NormalizesEmail_ToLowerCaseAndTrimmed()
    {
        // Act
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "  JOHN.DOE@EXAMPLE.COM  ",
            DateTime.UtcNow);

        // Assert
        Assert.Equal("john.doe@example.com", employee.Email);
    }

    [Fact]
    public void Create_TrimsNameFields()
    {
        // Act
        var employee = Employee.Create(
            ValidTenantId,
            "  John  ",
            "  Doe  ",
            "john@example.com",
            DateTime.UtcNow,
            "  Engineering  ",
            "  Developer  ");

        // Assert
        Assert.Equal("John", employee.FirstName);
        Assert.Equal("Doe", employee.LastName);
        Assert.Equal("Engineering", employee.Department);
        Assert.Equal("Developer", employee.JobTitle);
    }

    [Fact]
    public void Create_WithLocalDateTime_ConvertsToUtc()
    {
        // Arrange
        var localDate = new DateTime(2024, 1, 15, 9, 0, 0, DateTimeKind.Local);

        // Act
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            localDate);

        // Assert
        Assert.Equal(DateTimeKind.Utc, employee.HireDate.Kind);
    }

    [Fact]
    public void Create_WithEmptyTenantId_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            Employee.Create(
                Guid.Empty,
                "John",
                "Doe",
                "john@example.com",
                DateTime.UtcNow));

        Assert.Equal("tenantId", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidFirstName_ThrowsArgumentException(string? firstName)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            Employee.Create(
                ValidTenantId,
                firstName!,
                "Doe",
                "john@example.com",
                DateTime.UtcNow));

        Assert.Equal("firstName", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidLastName_ThrowsArgumentException(string? lastName)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            Employee.Create(
                ValidTenantId,
                "John",
                lastName!,
                "john@example.com",
                DateTime.UtcNow));

        Assert.Equal("lastName", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidEmail_ThrowsArgumentException(string? email)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            Employee.Create(
                ValidTenantId,
                "John",
                "Doe",
                email!,
                DateTime.UtcNow));

        Assert.Equal("email", ex.ParamName);
    }

    [Fact]
    public void Create_WithDefaultHireDate_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            Employee.Create(
                ValidTenantId,
                "John",
                "Doe",
                "john@example.com",
                default));

        Assert.Equal("hireDate", ex.ParamName);
    }

    [Fact]
    public void Create_WithUnspecifiedDateTimeKind_ThrowsArgumentException()
    {
        // Arrange
        var unspecifiedDate = new DateTime(2024, 1, 15, 9, 0, 0, DateTimeKind.Unspecified);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            Employee.Create(
                ValidTenantId,
                "John",
                "Doe",
                "john@example.com",
                unspecifiedDate));

        Assert.Equal("hireDate", ex.ParamName);
    }

    #endregion

    #region Activate/Deactivate Tests

    [Fact]
    public void Deactivate_WhenActive_SetsStatusToInactive()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Act
        employee.Deactivate();

        // Assert
        Assert.Equal(EmployeeStatus.Inactive, employee.Status);
    }

    [Fact]
    public void Deactivate_WhenAlreadyInactive_ThrowsInvalidOperationException()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);
        employee.Deactivate();

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => employee.Deactivate());
        Assert.Contains("already inactive", ex.Message);
    }

    [Fact]
    public void Activate_WhenInactive_SetsStatusToActive()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);
        employee.Deactivate();

        // Act
        employee.Activate();

        // Assert
        Assert.Equal(EmployeeStatus.Active, employee.Status);
    }

    [Fact]
    public void Activate_WhenAlreadyActive_ThrowsInvalidOperationException()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => employee.Activate());
        Assert.Contains("already active", ex.Message);
    }

    #endregion

    #region UpdateDetails Tests

    [Fact]
    public void UpdateDetails_WithValidInputs_UpdatesFields()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Act
        employee.UpdateDetails(
            "Jane",
            "Smith",
            "jane.smith@example.com",
            "HR",
            "Manager");

        // Assert
        Assert.Equal("Jane", employee.FirstName);
        Assert.Equal("Smith", employee.LastName);
        Assert.Equal("jane.smith@example.com", employee.Email);
        Assert.Equal("HR", employee.Department);
        Assert.Equal("Manager", employee.JobTitle);
    }

    [Fact]
    public void UpdateDetails_NormalizesEmail()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Act
        employee.UpdateDetails(
            "John",
            "Doe",
            "  UPDATED@EXAMPLE.COM  ",
            null,
            null);

        // Assert
        Assert.Equal("updated@example.com", employee.Email);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void UpdateDetails_WithInvalidFirstName_ThrowsArgumentException(string? firstName)
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            employee.UpdateDetails(firstName!, "Doe", "john@example.com", null, null));

        Assert.Equal("firstName", ex.ParamName);
    }

    #endregion

    #region AssignManager Tests

    [Fact]
    public void AssignManager_WithValidId_SetsManagerId()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);
        var managerId = Guid.NewGuid();

        // Act
        employee.AssignManager(managerId);

        // Assert
        Assert.Equal(managerId, employee.ManagerId);
    }

    [Fact]
    public void AssignManager_WithNull_ClearsManagerId()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);
        employee.AssignManager(Guid.NewGuid());

        // Act
        employee.AssignManager(null);

        // Assert
        Assert.Null(employee.ManagerId);
    }

    [Fact]
    public void AssignManager_WithEmptyGuid_ClearsManagerId()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);
        employee.AssignManager(Guid.NewGuid());

        // Act
        employee.AssignManager(Guid.Empty);

        // Assert
        Assert.Null(employee.ManagerId);
    }

    [Fact]
    public void AssignManager_WithOwnId_ThrowsArgumentException()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            employee.AssignManager(employee.Id));

        Assert.Equal("managerId", ex.ParamName);
        Assert.Contains("own manager", ex.Message);
    }

    #endregion

    #region FullName Tests

    [Fact]
    public void FullName_CombinesFirstAndLastName()
    {
        // Arrange
        var employee = Employee.Create(
            ValidTenantId,
            "John",
            "Doe",
            "john@example.com",
            DateTime.UtcNow);

        // Assert
        Assert.Equal("John Doe", employee.FullName);
    }

    #endregion
}
