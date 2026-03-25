using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Questions;

public class QuestionService(AppDbContext dbContext) : IQuestionService
{
    public async Task<PagedResultDto<QuestionDto>> GetAsync(QuestionFilterDto filter, CancellationToken cancellationToken)
    {
        ValidatePaging(filter.Page, filter.PageSize);

        var query = dbContext.Questions
            .AsNoTracking()
            .Include(q => q.Options)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var keyword = filter.Search.Trim();
            query = query.Where(q => q.Title.Contains(keyword) || q.Description.Contains(keyword));
        }

        if (filter.Types.Length > 0)
        {
            var types = filter.Types.Select(ParseQuestionType).ToHashSet();
            query = query.Where(q => types.Contains(q.Type));
        }

        if (filter.Difficulties.Length > 0)
        {
            var difficulties = filter.Difficulties.Select(ParseDifficulty).ToHashSet();
            query = query.Where(q => difficulties.Contains(q.Difficulty));
        }

        if (filter.GradingMethods.Length > 0)
        {
            var gradingMethods = filter.GradingMethods.Select(ParseGradingMethod).ToHashSet();
            query = query.Where(q => gradingMethods.Contains(q.GradingMethod));
        }

        query = filter.Sort.Trim().ToLowerInvariant() switch
        {
            "oldest" => query.OrderBy(q => q.CreatedAt),
            "most_used" => query.OrderByDescending(q => q.UsageCount),
            "points" => query.OrderByDescending(q => q.Points),
            _ => query.OrderByDescending(q => q.CreatedAt)
        };

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<QuestionDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize),
            Page = filter.Page,
            PageSize = filter.PageSize
        };
    }

    public async Task<QuestionDto> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var question = await dbContext.Questions
            .AsNoTracking()
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (question is null)
            throw new ApiException("Question not found.", StatusCodes.Status404NotFound);

        return MapToDto(question);
    }

    public async Task<QuestionDto> CreateAsync(CreateQuestionDto request, CancellationToken cancellationToken)
    {
        ValidateRequest(request);

        var question = new Question
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Type = ParseQuestionType(request.Type),
            Difficulty = ParseDifficulty(request.Difficulty),
            GradingMethod = ParseGradingMethod(request.GradingMethod),
            Points = request.Points,
            DurationMinutes = request.DurationMinutes,
            Tags = request.Tags.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList(),
            UsageCount = 0,
            Language = string.IsNullOrWhiteSpace(request.Language) ? null : request.Language.Trim(),
            StarterCode = string.IsNullOrWhiteSpace(request.StarterCode) ? null : request.StarterCode,
            EvaluationCriteria = string.IsNullOrWhiteSpace(request.EvaluationCriteria) ? null : request.EvaluationCriteria.Trim(),
            Options = request.Options.Select(o => new QuestionOption
            {
                Id = Guid.NewGuid(),
                Text = o.Text.Trim(),
                Correct = o.Correct
            }).ToList()
        };

        dbContext.Questions.Add(question);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(question);
    }

    public async Task<QuestionDto> UpdateAsync(Guid id, UpdateQuestionDto request, CancellationToken cancellationToken)
    {
        ValidateRequest(request);

        var question = await dbContext.Questions
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (question is null)
            throw new ApiException("Question not found.", StatusCodes.Status404NotFound);

        question.Title = request.Title.Trim();
        question.Description = request.Description.Trim();
        question.Type = ParseQuestionType(request.Type);
        question.Difficulty = ParseDifficulty(request.Difficulty);
        question.GradingMethod = ParseGradingMethod(request.GradingMethod);
        question.Points = request.Points;
        question.DurationMinutes = request.DurationMinutes;
        question.Tags = request.Tags.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        question.Language = string.IsNullOrWhiteSpace(request.Language) ? null : request.Language.Trim();
        question.StarterCode = string.IsNullOrWhiteSpace(request.StarterCode) ? null : request.StarterCode;
        question.EvaluationCriteria = string.IsNullOrWhiteSpace(request.EvaluationCriteria) ? null : request.EvaluationCriteria.Trim();

        dbContext.QuestionOptions.RemoveRange(question.Options);
        question.Options = request.Options.Select(o => new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionId = question.Id,
            Text = o.Text.Trim(),
            Correct = o.Correct
        }).ToList();

        await dbContext.SaveChangesAsync(cancellationToken);
        return MapToDto(question);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var question = await dbContext.Questions.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (question is null)
            throw new ApiException("Question not found.", StatusCodes.Status404NotFound);

        dbContext.Questions.Remove(question);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static QuestionDto MapToDto(Question question)
    {
        return new QuestionDto
        {
            Id = question.Id.ToString(),
            Title = question.Title,
            Description = question.Description,
            Type = ToContract(question.Type),
            Difficulty = question.Difficulty.ToString(),
            GradingMethod = ToContract(question.GradingMethod),
            Points = question.Points,
            DurationMinutes = question.DurationMinutes,
            Tags = question.Tags,
            UsageCount = question.UsageCount
        };
    }

    private static void ValidatePaging(int page, int pageSize)
    {
        if (page <= 0 || pageSize <= 0)
            throw new ApiException("Invalid pagination values.", StatusCodes.Status400BadRequest);
    }

    private static void ValidateRequest(CreateQuestionDto request)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(request.Title))
            errors.Add("title is required.");
        if (request.Title.Length > 200)
            errors.Add("title max length is 200.");
        if (request.Points <= 0)
            errors.Add("points must be greater than 0.");
        if (request.DurationMinutes <= 0)
            errors.Add("durationMinutes must be greater than 0.");

        var type = ParseQuestionType(request.Type);
        _ = ParseDifficulty(request.Difficulty);
        _ = ParseGradingMethod(request.GradingMethod);

        if ((type is QuestionType.MultipleChoice or QuestionType.TrueFalse)
            && (request.Options.Count == 0 || !request.Options.Any(x => x.Correct)))
        {
            errors.Add("Multiple Choice and True/False questions require options and at least one correct option.");
        }

        if ((type is QuestionType.Coding or QuestionType.Sql) && string.IsNullOrWhiteSpace(request.Language))
            errors.Add("Coding and SQL questions require language.");

        if (request.Options.Any(o => string.IsNullOrWhiteSpace(o.Text)))
            errors.Add("option text is required.");

        if (errors.Count > 0)
            throw new ApiException("Validation failed.", StatusCodes.Status400BadRequest, errors);
    }

    private static QuestionType ParseQuestionType(string value)
    {
        return value.Trim() switch
        {
            "Coding" => QuestionType.Coding,
            "SQL" => QuestionType.Sql,
            "Multiple Choice" => QuestionType.MultipleChoice,
            "Essay" => QuestionType.Essay,
            "Case Study" => QuestionType.CaseStudy,
            "Excel" => QuestionType.Excel,
            "True/False" => QuestionType.TrueFalse,
            "Design" => QuestionType.Design,
            _ => throw new ApiException($"Invalid QuestionType value '{value}'.", StatusCodes.Status400BadRequest)
        };
    }

    private static Difficulty ParseDifficulty(string value)
    {
        return value.Trim() switch
        {
            "Easy" => Difficulty.Easy,
            "Medium" => Difficulty.Medium,
            "Hard" => Difficulty.Hard,
            "Expert" => Difficulty.Expert,
            _ => throw new ApiException($"Invalid Difficulty value '{value}'.", StatusCodes.Status400BadRequest)
        };
    }

    private static GradingMethod ParseGradingMethod(string value)
    {
        return value.Trim() switch
        {
            "Auto-graded" => GradingMethod.AutoGraded,
            "Hybrid" => GradingMethod.Hybrid,
            "Manual" => GradingMethod.Manual,
            _ => throw new ApiException($"Invalid GradingMethod value '{value}'.", StatusCodes.Status400BadRequest)
        };
    }

    private static string ToContract(QuestionType type)
    {
        return type switch
        {
            QuestionType.Sql => "SQL",
            QuestionType.MultipleChoice => "Multiple Choice",
            QuestionType.CaseStudy => "Case Study",
            QuestionType.TrueFalse => "True/False",
            _ => type.ToString()
        };
    }

    private static string ToContract(GradingMethod method)
    {
        return method switch
        {
            GradingMethod.AutoGraded => "Auto-graded",
            _ => method.ToString()
        };
    }
}
