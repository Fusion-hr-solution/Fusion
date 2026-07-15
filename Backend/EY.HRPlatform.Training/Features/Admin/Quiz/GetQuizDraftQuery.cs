using System.Text.Json;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>US-8.2.5 — read a training's quiz draft (and whether AI generation is available).</summary>
public record GetQuizDraftQuery(Guid TrainingId) : IQuery<Result<QuizDraftDto>>;

public class GetQuizDraftQueryHandler : IQueryHandler<GetQuizDraftQuery, Result<QuizDraftDto>>
{
    private readonly TrainingDbContext _db;
    private readonly IServiceProvider _serviceProvider;

    public GetQuizDraftQueryHandler(TrainingDbContext db, IServiceProvider serviceProvider)
    {
        _db = db;
        _serviceProvider = serviceProvider;
    }

    public async Task<Result<QuizDraftDto>> Handle(GetQuizDraftQuery request, CancellationToken cancellationToken)
    {
        var aiAvailable = _serviceProvider.GetService<ILlmClient>() is not null;

        var draft = await _db.QuizDrafts.AsNoTracking()
            .FirstOrDefaultAsync(d => d.TrainingId == request.TrainingId, cancellationToken);

        List<QuizDraftQuestionDto> questions = [];
        if (draft is not null)
        {
            try
            {
                questions = JsonSerializer.Deserialize<List<QuizDraftQuestionDto>>(draft.QuestionsJson) ?? [];
            }
            catch (JsonException)
            {
                // A corrupted draft payload should read as "no draft" rather than 500.
                questions = [];
            }
        }

        return Result.Success(new QuizDraftDto
        {
            TrainingId = request.TrainingId,
            AiAvailable = aiAvailable,
            Questions = questions,
        });
    }
}
