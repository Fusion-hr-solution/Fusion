using System.Text.Json;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>US-8.2.5 — generate MCQ quiz questions from a training's content into its QuizDraft (ADR 0009).</summary>
public record GenerateQuizCommand(Guid TrainingId, int Count, Guid EmployeeId) : ICommand<Result<QuizDraftDto>>;

public class GenerateQuizCommandHandler : ICommandHandler<GenerateQuizCommand, Result<QuizDraftDto>>
{
    private const int MaxContentChars = 12000;
    private const int MinContentChars = 200;

    private static readonly JsonSerializerOptions ParseOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    private readonly TrainingDbContext _db;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<GenerateQuizCommandHandler> _logger;

    public GenerateQuizCommandHandler(
        TrainingDbContext db, IServiceProvider serviceProvider, ILogger<GenerateQuizCommandHandler> logger)
    {
        _db = db;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<Result<QuizDraftDto>> Handle(GenerateQuizCommand request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId && !t.IsDeleted, cancellationToken);
        if (training is null)
            return Result.Failure<QuizDraftDto>(Error.NotFound("Training", request.TrainingId));

        var llm = _serviceProvider.GetService<ILlmClient>();
        if (llm is null)
            return Result.Failure<QuizDraftDto>(Error.Validation(
                "Quiz.LlmUnavailable", "AI quiz generation is not configured."));

        var articles = await _db.Set<ContentBlock>().AsNoTracking()
            .Where(cb => cb.Chapter.TrainingId == request.TrainingId && cb.Type == ContentType.Article)
            .OrderBy(cb => cb.Chapter.OrderIndex).ThenBy(cb => cb.OrderIndex)
            .Select(cb => new { cb.Title, cb.TextContent })
            .ToListAsync(cancellationToken);

        var context = string.Join("\n\n", articles
                .Select(a => string.Join("\n", new[] { a.Title, a.TextContent }.Where(x => !string.IsNullOrWhiteSpace(x)))))
            .Trim();
        if (context.Length < MinContentChars)
            return Result.Failure<QuizDraftDto>(Error.Validation(
                "Quiz.NoContent", "This training has too little text content to generate a quiz from."));
        if (context.Length > MaxContentChars)
            context = context[..MaxContentChars];

        var count = Math.Clamp(request.Count, 1, 20);

        // Headroom for the JSON of up to `count` questions (text + 4 options + explanation).
        var maxTokens = 512 + count * 180;

        List<QuizDraftQuestionDto> questions;
        try
        {
            var raw = await llm.CompleteAsync(
                SystemPrompt(count), UserPrompt(training.Title, context), cancellationToken, maxTokens: maxTokens);
            questions = Parse(raw);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI quiz generation failed for training {TrainingId}", request.TrainingId);
            return Result.Failure<QuizDraftDto>(Error.Validation(
                "Quiz.GenerationFailed", "The AI could not generate a quiz. Please try again."));
        }

        if (questions.Count == 0)
            return Result.Failure<QuizDraftDto>(Error.Validation(
                "Quiz.GenerationFailed", "The AI returned no usable questions. Please try again."));

        var json = JsonSerializer.Serialize(questions);
        await UpsertDraftAsync(request.TrainingId, request.EmployeeId, json, cancellationToken);

        return Result.Success(new QuizDraftDto { TrainingId = request.TrainingId, AiAvailable = true, Questions = questions });
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
            // Lost the race on the unique (TrainingId) index against a concurrent generate — re-read and replace.
            _db.ChangeTracker.Clear();
            var existing = await _db.QuizDrafts.FirstOrDefaultAsync(d => d.TrainingId == trainingId, cancellationToken);
            if (existing is not null)
            {
                existing.Replace(json, employeeId);
                await _db.SaveChangesAsync(cancellationToken);
            }
        }
    }

    private static string SystemPrompt(int count) =>
        $"You write multiple-choice quiz questions from training material. Produce exactly {count} questions. " +
        "Return ONLY a JSON array — no prose, no markdown fences. Each item must be exactly: " +
        "{\"text\": string, \"options\": [4 strings], \"correctIndex\": integer 0-3, \"explanation\": string}. " +
        "Exactly one correct option per question. Base every question strictly on the provided content.";

    private static string UserPrompt(string title, string context) => $"Training: {title}\n\nContent:\n{context}";

    private static List<QuizDraftQuestionDto> Parse(string raw)
    {
        var parsed = JsonSerializer.Deserialize<List<LlmQuestion>>(ExtractJsonArray(raw), ParseOptions) ?? [];

        var result = new List<QuizDraftQuestionDto>();
        var order = 0;
        foreach (var q in parsed)
        {
            if (string.IsNullOrWhiteSpace(q.Text) || q.Options is null || q.Options.Count < 2) continue;
            if (q.CorrectIndex is null) continue; // no declared answer — drop rather than default to option 0

            // Compute IsCorrect from the original index, then drop empty options.
            var options = q.Options
                .Select((o, i) => new QuizDraftOptionDto { Text = (o ?? string.Empty).Trim(), IsCorrect = i == q.CorrectIndex.Value })
                .Where(o => o.Text.Length > 0)
                .ToList();
            if (options.Count < 2 || !options.Any(o => o.IsCorrect)) continue;

            result.Add(new QuizDraftQuestionDto
            {
                Text = q.Text.Trim(),
                Type = nameof(QuestionType.SingleChoice),
                Points = 1,
                Explanation = string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation.Trim(),
                Order = order++,
                Source = "ai",
                Options = options,
            });
        }
        return result;
    }

    private static string ExtractJsonArray(string raw)
    {
        var text = raw.Trim();
        var start = text.IndexOf('[');
        var end = text.LastIndexOf(']');
        return start >= 0 && end > start ? text[start..(end + 1)] : text;
    }

    private sealed class LlmQuestion
    {
        public string? Text { get; set; }
        public List<string?>? Options { get; set; }
        public int? CorrectIndex { get; set; }
        public string? Explanation { get; set; }
    }
}
