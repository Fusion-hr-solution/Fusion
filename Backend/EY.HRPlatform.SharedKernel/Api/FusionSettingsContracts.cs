namespace EY.HRPlatform.SharedKernel.Api;

// The cross-module settings section contract (B-071 D1), mirrored by `@repo/api` fusion-settings.ts.
// Each module serves its own sections at `GET /api/{module}/settings/sections`, for the caller only.

/// <summary>Who last changed a section and when. <paramref name="ActorName"/> is "Someone" when it can't be resolved.</summary>
public sealed record FusionSettingsLastChangeDto(DateTime At, string ActorName);

/// <summary>
/// One settings section the caller may open. <paramref name="Id"/> is stable within the module,
/// <paramref name="Path"/> is the absolute in-app path of its page, and <paramref name="Access"/> is
/// <see cref="View"/> or <see cref="Manage"/>. A section the caller can't view is never listed.
/// <paramref name="LastChange"/> is null when the section was never changed; the page then shows
/// <paramref name="SetUpAt"/>, when its record was created (null before it exists).
/// </summary>
public sealed record FusionSettingsSectionDto(
    string Id,
    string Label,
    int Order,
    string Path,
    string Access,
    FusionSettingsLastChangeDto? LastChange,
    DateTime? SetUpAt = null)
{
    public const string View = "view";
    public const string Manage = "manage";
}
