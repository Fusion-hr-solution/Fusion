using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateExamQuestionCommand(
    Guid TrainingId,
    Guid ExamId,
    Guid QuestionId,
    string QuestionText,
    string Type,
    int Points,
    List<AddExamQuestionOptionItem> Options) : ICommand<Result>;
