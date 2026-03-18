using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Domain.Entities;
using EY.HRPlatform.Interview.QuestionBank.Infrastructure.Repositories;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;
using MediatR;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Commands;

public class CreateQuestionCommandHandler : ICommandHandler<CreateQuestionCommand, QuestionDto>
{
    private readonly IQuestionRepository _repository;

    public CreateQuestionCommandHandler(IQuestionRepository repository)
    {
        _repository = repository;
    }

    public async Task<QuestionDto> Handle(CreateQuestionCommand request, CancellationToken cancellationToken)
    {
        var question = new Question
        {
            Title = request.Request.Title,
            Description = request.Request.Description,
            Type = request.Request.Type,
            Difficulty = request.Request.Difficulty,
            GradingMethod = request.Request.GradingMethod,
            Points = request.Request.Points,
            DurationMinutes = request.Request.DurationMinutes,
            Tags = request.Request.Tags,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        if (request.Request.Options?.Any() == true)
        {
            question.Options = request.Request.Options
                .Select(o => new QuestionOption
                {
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    SortOrder = o.SortOrder
                })
                .ToList();
        }

        var created = await _repository.AddAsync(question);
        return MapToDto(created);
    }

    private static QuestionDto MapToDto(Question question)
    {
        return new QuestionDto
        {
            Id = question.Id,
            Title = question.Title,
            Description = question.Description,
            Type = question.Type,
            Difficulty = question.Difficulty,
            GradingMethod = question.GradingMethod,
            Points = question.Points,
            DurationMinutes = question.DurationMinutes,
            Tags = question.Tags,
            UsageCount = question.UsageCount,
            IsActive = question.IsActive,
            CreatedAt = question.CreatedAt,
            UpdatedAt = question.UpdatedAt,
            Options = question.Options?.Select(o => new QuestionOptionResponseDto
            {
                Id = o.Id,
                Text = o.Text,
                IsCorrect = o.IsCorrect,
                SortOrder = o.SortOrder
            }).OrderBy(o => o.SortOrder).ToList()
        };
    }
}