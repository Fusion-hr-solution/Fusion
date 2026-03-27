namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

/// <summary>
/// Configuration for a single employee field.
/// </summary>
/// <param name="Visible">Whether the field is visible in the UI.</param>
/// <param name="Required">Whether the field is required for validation.</param>
public sealed record FieldConfig(bool Visible, bool Required);
