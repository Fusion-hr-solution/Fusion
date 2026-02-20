namespace EY.HRPlatform.Identity.Domain.Enums;

public static class PlatformRole
{
    public const string Admin = "Admin";
    public const string HR = "HR";
    public const string Employee = "Employee";
    public const string Manager = "Manager";

    public static readonly string[] All = { Admin, HR, Employee, Manager };
}