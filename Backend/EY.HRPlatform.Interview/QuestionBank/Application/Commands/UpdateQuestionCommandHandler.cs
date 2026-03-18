using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Domain.Entities;
using EY.HRPlatform.Interview.QuestionBank.Infrastructure.Repositories;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;
using MediatR;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Commands;

public class UpdateQuestionCommandHandler : ICommandHandler<UpdateQuestionCommand, QuestionDto>
{
    private readonly IQuestionRepository _repository;

    public UpdateQuestionCommandHandler(IQuestionRepository repository)
    {
        _repository = repository;
    }

    public async Task<QuestionDto> Handle(UpdateQuestionCommand request, CancellationToken cancellationToken)
    {
        var question = await _repository.GetByIdAsync(request.Id);

        if (question == null)
            throw new InvalidOperationException($"Question with id {request.Id} not found");

        question.Title = request.Request.Title;
        question.Description = request.Request.Description;
        question.Type = request.Request.Type;
        question.Difficulty = request.Request.Difficulty;
        question.GradingMethod = request.Request.GradingMethod;
        question.Points = request.Request.Points;
        question.DurationMinutes = request.Request.DurationMinutes;
        question.Tags = request.Request.Tags;

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

        var updated = await _repository.UpdateAsync(question);
        return MapToDto(updated);
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