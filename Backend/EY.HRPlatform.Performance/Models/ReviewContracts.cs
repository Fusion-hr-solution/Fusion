using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Models;

public sealed record ReviewItemResponseInput(ReviewItemKind Kind, Guid ItemId, string? Reflection, int? Rating,
    string? Comment, string? Assessment);
/// <summary>An answer to one of the round's frozen questions (the question snapshot id).</summary>
public sealed record ReviewAnswerInput(Guid QuestionId, string? Text);
public sealed record SaveSelfAssessmentRequest([property: JsonRequired] uint ExpectedVersion, string Summary,
    IReadOnlyList<ReviewItemResponseInput>? Items = null)
{
    public int? OverallRating { get; init; }
    public IReadOnlyList<ReviewAnswerInput>? Answers { get; init; }
}
public sealed record SaveManagerAssessmentRequest([property: JsonRequired] uint ExpectedVersion, string Summary, int? OverallRating,
    IReadOnlyList<ReviewItemResponseInput>? Items = null)
{
    public ReviewPotential? Potential { get; init; }
    public IReadOnlyList<ReviewAnswerInput>? Answers { get; init; }
}
public sealed record FinalizeReviewRoundRequest([property: JsonRequired] uint ExpectedVersion, IReadOnlyList<Guid>? ReviewIds = null);
public sealed record FinalizeReviewRequest([property: JsonRequired] uint ExpectedVersion);
public sealed record CloseReviewRequest([property: JsonRequired] uint ExpectedVersion, string Reason);
public sealed record AcknowledgeReviewRequest(string? Comment);

/// <summary>What a submit is missing, so the page can point at each gap.</summary>
public sealed record ReviewMissingDto(IReadOnlyList<ReviewMissingItemDto> Items, IReadOnlyList<Guid> Questions, bool Summary,
    bool OverallRating, bool Potential);
public sealed record ReviewMissingItemDto(ReviewItemKind Kind, Guid ItemId);
