namespace EY.HRPlatform.Performance.Features.Feedback.Dtos;

public sealed record FeedbackAnswerInput(Guid PromptSnapshotId, string AnswerText);

public sealed record FeedbackPromptDefinitionInput(string PromptText, string? Description, bool IsRequired, int DisplayOrder);

public sealed record ReviseFeedbackResponseRequest(IReadOnlyList<FeedbackAnswerRequest> Answers, string? GeneralComment);

public sealed record FeedbackAnswerRequest(Guid PromptSnapshotId, string AnswerText);

public sealed record FeedbackIdentityDto(Guid WorkItemId, Guid ReviewerEmployeeId);
