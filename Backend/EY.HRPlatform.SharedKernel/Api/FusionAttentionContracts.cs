namespace EY.HRPlatform.SharedKernel.Api;

// The cross-module attention contract (D-29, D-30), mirrored by `@repo/api` fusion-attention.ts.
// Each module serves its own items at `GET /api/{module}/work`, composing display text in English.

/// <summary>The person a work item concerns, when it isn't the viewer.</summary>
public sealed record FusionWorkSubjectDto(string DisplayName);

/// <summary>
/// Something the person must do. Derived from the module's current state, so it disappears as soon as
/// the work is done. <paramref name="Id"/> is stable (`{module}:{kind}:{resourceId}`) and
/// <paramref name="Href"/> is the absolute in-app path where the work is done.
/// </summary>
public sealed record FusionWorkItemDto(
    string Id,
    string Module,
    string Kind,
    string Title,
    string? Context,
    DateOnly? DueOn,
    string Href,
    FusionWorkSubjectDto? Subject = null);
