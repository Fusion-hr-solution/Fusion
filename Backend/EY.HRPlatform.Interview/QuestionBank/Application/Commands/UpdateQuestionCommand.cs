using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Models.Requests;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Commands;

public record UpdateQuestionCommand(Guid Id, CreateQuestionRequest Request) : ICommand<QuestionDto>;