using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class EmployeeIdentityTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidInputs_ReturnsNormalizedEmployee()
    {
        var employee = Employee.Create(
            TenantId,
            "  John  ",
            "  Doe  ",
            "  JOHN.DOE@EXAMPLE.COM  ",
            department: "  Engineering  ",
            employeeNumber: " emp-001 ",
            phone: "  +216 20 000 000  ");

        Assert.Equal(TenantId, employee.TenantId);
        Assert.Equal("John", employee.FirstName);
        Assert.Equal("Doe", employee.LastName);
        Assert.Equal("john.doe@example.com", employee.Email);
        Assert.Equal("Engineering", employee.Department);
        Assert.Equal("EMP-001", employee.EmployeeNumber);
        Assert.Equal("+216 20 000 000", employee.Phone);
    }

    [Fact]
    public void UpdateProfile_UpdatesCoreOwnedIdentityFields()
    {
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com");

        employee.UpdateProfile("Jane", "Smith", "JANE@EXAMPLE.COM", "Janie", "12345");

        Assert.Equal("Jane", employee.FirstName);
        Assert.Equal("Smith", employee.LastName);
        Assert.Equal("jane@example.com", employee.Email);
        Assert.Equal("Janie", employee.PreferredName);
        Assert.Equal("12345", employee.Phone);
    }

    [Fact]
    public void UpdatePreferredName_WithWhitespace_ClearsValue()
    {
        var employee = Employee.Create(TenantId, "John", "Doe", "john@example.com");
        employee.UpdatePreferredName("Johnny");

        employee.UpdatePreferredName("   ");

        Assert.Null(employee.PreferredName);
    }
}
