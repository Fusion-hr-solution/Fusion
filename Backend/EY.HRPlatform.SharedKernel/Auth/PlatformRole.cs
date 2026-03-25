namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Platform-wide role constants for authorization.
/// Used across all modules for role-based access control.
/// </summary>
public static class PlatformRole
{
    public const string Admin = "Admin";
    public const string HR = "HR";
    public const string Employee = "Employee";
    public const string Manager = "Manager";

    public static readonly string[] All = [Admin, HR, Employee, Manager];
}
