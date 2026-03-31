namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

/// <summary>
/// Configuration for a single employee field.
/// </summary>
/// <param name="Visible">Whether the field is visible in the UI (HR Admin view).</param>
/// <param name="Required">Whether the field is required for validation.</param>
/// <param name="VisibleToEmployee">Whether the field is visible to employees viewing their own profile.</param>
/// <param name="VisibleToManager">Whether the field is visible to managers viewing their reports.</param>
public sealed record FieldConfig(
    bool Visible,
    bool Required,
    bool VisibleToEmployee = true,
    bool VisibleToManager = true
);
