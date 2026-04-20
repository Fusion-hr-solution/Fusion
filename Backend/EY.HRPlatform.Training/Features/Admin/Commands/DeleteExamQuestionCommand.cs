using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record DeleteExamQuestionCommand(Guid TrainingId, Guid ExamId, Guid QuestionId) : ICommand<Result>;
