using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackResponses;

/// <summary>
/// Retrieve anonymized feedback responses for a subject + type cohort.
/// D-06: queries only FeedbackResponseContents — never joins FeedbackIdentityMappings.
/// D-08/D-09: suppresses output when cohort is below minimum threshold.
/// </summary>
public sealed record GetFeedbackResponsesQuery(
    Guid CycleId,
    Guid SubjectEmployeeId,
    CampaignWorkItemType FeedbackType) : IQuery<Result<FeedbackResponseListDto>>;
