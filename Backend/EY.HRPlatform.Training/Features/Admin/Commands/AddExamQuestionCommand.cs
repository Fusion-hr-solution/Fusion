using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AddExamQuestionCommand(
    Guid TrainingId,
    Guid ExamId,
    string QuestionText,
    string Type,
    int Points,
    List<AddExamQuestionOptionItem> Options) : ICommand<Result<Guid>>;

public record AddExamQuestionOptionItem(string OptionText, bool IsCorrect);
