using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackThresholdStatus;

/// <summary>
/// Returns per-cohort threshold status: current count, minimum required, suppression flags.
/// D-08: per-type per-subject cohort.
/// D-09: hard suppression below threshold — CurrentCount hidden from non-admin consumers.
/// </summary>
public sealed record GetFeedbackThresholdStatusQuery(
    Guid CycleId,
    Guid SubjectEmployeeId,
    CampaignWorkItemType FeedbackType) : IQuery<Result<FeedbackThresholdStatusDto>>;
