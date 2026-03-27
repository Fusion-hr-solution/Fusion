namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

/// <summary>
/// Tenant branding configuration.
/// </summary>
public sealed record BrandingSettings
{
    /// <summary>
    /// URL to the tenant's logo image. Null means use platform default.
    /// </summary>
    public string? LogoUrl { get; init; }

    /// <summary>
    /// Primary brand color in hex format.
    /// </summary>
    public string PrimaryColor { get; init; } = "#1a365d";
}
