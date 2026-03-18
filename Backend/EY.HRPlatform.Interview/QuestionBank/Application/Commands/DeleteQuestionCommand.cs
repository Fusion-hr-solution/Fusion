using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Commands;

public record DeleteQuestionCommand(Guid Id) : ICommand;