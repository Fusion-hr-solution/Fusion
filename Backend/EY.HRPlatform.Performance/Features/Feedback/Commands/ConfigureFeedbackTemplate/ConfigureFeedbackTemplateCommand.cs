using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.ConfigureFeedbackTemplate;

public sealed record ConfigureFeedbackTemplateCommand(
    Guid CycleId,
    string FeedbackType,
    string Name,
    IReadOnlyList<FeedbackPromptDefinitionInput> Prompts) : ICommand<Result<Guid>>;
