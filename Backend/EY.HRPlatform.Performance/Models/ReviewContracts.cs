using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Models;

public sealed record ReviewItemResponseInput(ReviewItemKind Kind, Guid ItemId, string? Reflection, int? Rating,
    string? Comment, string? Assessment);
public sealed record SaveSelfAssessmentRequest([property: JsonRequired] uint ExpectedVersion, string Summary,
    IReadOnlyList<ReviewItemResponseInput>? Items = null);
public sealed record SaveManagerAssessmentRequest([property: JsonRequired] uint ExpectedVersion, string Summary, int? OverallRating,
    IReadOnlyList<ReviewItemResponseInput>? Items = null);
public sealed record FinalizeReviewRoundRequest([property: JsonRequired] uint ExpectedVersion, IReadOnlyList<Guid>? ReviewIds = null);
public sealed record FinalizeReviewRequest([property: JsonRequired] uint ExpectedVersion);
public sealed record CloseReviewRequest([property: JsonRequired] uint ExpectedVersion, string Reason);
