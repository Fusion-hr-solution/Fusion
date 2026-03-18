using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Queries;

public record GetQuestionByIdQuery(Guid Id) : IQuery<QuestionDto?>;