using System.Text.Json;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>US-8.2.5 — persist the admin's reviewed/edited quiz draft (scratch space; replaces the row).</summary>
public record SaveQuizDraftCommand(Guid TrainingId, IReadOnlyList<QuizQuestionInput> Questions, Guid EmployeeId)
    : ICommand<Result<QuizDraftDto>>;

public class SaveQuizDraftCommandHandler : ICommandHandler<SaveQuizDraftCommand, Result<QuizDraftDto>>
{
    private readonly TrainingDbContext _db;
    private readonly IServiceProvider _serviceProvider;

    public SaveQuizDraftCommandHandler(TrainingDbContext db, IServiceProvider serviceProvider)
    {
        _db = db;
        _serviceProvider = serviceProvider;
    }

    public async Task<Result<QuizDraftDto>> Handle(SaveQuizDraftCommand request, CancellationToken cancellationToken)
    {
        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId && !t.IsDeleted, cancellationToken);
        if (!trainingExists)
            return Result.Failure<QuizDraftDto>(Error.NotFound("Training", request.TrainingId));

        var questions = Normalize(request.Questions);
        var json = JsonSerializer.Serialize(questions);
        await UpsertDraftAsync(request.TrainingId, request.EmployeeId, json, cancellationToken);

        var aiAvailable = _serviceProvider.GetService<ILlmClient>() is not null;
        return Result.Success(new QuizDraftDto
        {
            TrainingId = request.TrainingId,
            AiAvailable = aiAvailable,
            Questions = questions,
        });
    }

    /// <summary>Trim and re-sequence the draft as sent. Drafts are scratch space — strict checks happen on publish.</summary>
    private static List<QuizDraftQuestionDto> Normalize(IReadOnlyList<QuizQuestionInput> input)
    {
        var result = new List<QuizDraftQuestionDto>();
        var order = 0;
        foreach (var q in input)
        {
            result.Add(new QuizDraftQuestionDto
            {
                Text = (q.Text ?? string.Empty).Trim(),
                Type = string.IsNullOrWhiteSpace(q.Type) ? nameof(Domain.Enums.QuestionType.SingleChoice) : q.Type.Trim(),
                Points = q.Points < 1 ? 1 : q.Points,
                Explanation = string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation.Trim(),
                Order = order++,
                Source = string.IsNullOrWhiteSpace(q.Source) ? "manual" : q.Source.Trim(),
                Options = (q.Options ?? [])
                    .Select(o => new QuizDraftOptionDto { Text = (o.Text ?? string.Empty).Trim(), IsCorrect = o.IsCorrect })
                    .ToList(),
            });
        }
        return result;
    }

    private async Task UpsertDraftAsync(Guid trainingId, Guid employeeId, string json, CancellationToken cancellationToken)
    {
        try
        {
            var existing = await _db.QuizDrafts.FirstOrDefaultAsync(d => d.TrainingId == trainingId, cancellationToken);
            if (existing is null)
                _db.QuizDrafts.Add(new QuizDraft(trainingId, employeeId, json));
            else
                existing.Replace(json, employeeId);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Lost the race on the unique (TrainingId) index — re-read and replace.
            _db.ChangeTracker.Clear();
            var existing = await _db.QuizDrafts.FirstOrDefaultAsync(d => d.TrainingId == trainingId, cancellationToken);
            if (existing is not null)
            {
                existing.Replace(json, employeeId);
                await _db.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
