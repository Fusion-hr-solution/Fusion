using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record ReorderExamQuestionsCommand(
    Guid TrainingId,
    Guid ExamId,
    List<Guid> QuestionIds) : ICommand<Result>;
