namespace EY.HRPlatform.SharedKernel.Constants;

/// <summary>
/// Well-known constants for development and demo environments.
/// These should NOT be used in production.
/// </summary>
public static class DemoConstants
{
    /// <summary>
    /// Demo tenant ID used for local development and seeding.
    /// All seeders must use this same GUID to ensure data consistency across services.
    /// </summary>
    public static readonly Guid TenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
}
