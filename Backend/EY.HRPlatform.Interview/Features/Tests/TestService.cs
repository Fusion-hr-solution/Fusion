using System.Text.Json;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Tests;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using static EY.HRPlatform.Interview.Domain.QuestionContracts;

namespace EY.HRPlatform.Interview.Features.Tests;

public class TestService(AppDbContext dbContext, IDistributedCache cache, ILogger<TestService> logger) : ITestService
{
    private static readonly string[] CachedStatuses = ["Active", "Draft", "Archived"];
    private static readonly DistributedCacheEntryOptions CacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
    };

    private static string TestsCacheKey(string status) => $"tests:{status}";

    private async Task InvalidateTestsCacheAsync(CancellationToken ct)
    {
        foreach (var status in CachedStatuses)
        {
            try
            {
                await cache.RemoveAsync(TestsCacheKey(status), ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Cache invalidation failed for key '{Key}'.", TestsCacheKey(status));
            }
        }
    }
    public async Task<PagedResultDto<TestDto>> GetAsync(TestFilterDto filter, CancellationToken cancellationToken)
    {
        ValidatePaging(filter.Page, filter.PageSize);

        var isSimpleStatusQuery = filter.Page == 1
            && filter.PageSize >= 100
            && string.IsNullOrWhiteSpace(filter.Search)
            && string.IsNullOrWhiteSpace(filter.Discipline)
            && string.IsNullOrWhiteSpace(filter.QuestionType)
            && !string.IsNullOrWhiteSpace(filter.Status);

        if (isSimpleStatusQuery)
        {
            var cacheKey = TestsCacheKey(filter.Status!);
            try
            {
                var cached = await cache.GetStringAsync(cacheKey, cancellationToken);
                if (cached is not null)
                {
                    var cachedResult = JsonSerializer.Deserialize<PagedResultDto<TestDto>>(cached);
                    if (cachedResult is not null)
                        return cachedResult;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Cache read failed for key '{Key}'; falling through to database.", cacheKey);
            }
        }

        var query = dbContext.Tests
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var keyword = filter.Search.Trim();
            query = query.Where(t => t.Title.Contains(keyword) || t.Description.Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(filter.Discipline))
        {
            var discipline = ParseDiscipline(filter.Discipline);
            query = query.Where(t => t.Discipline == discipline);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var status = ParseStatus(filter.Status);
            query = query.Where(t => t.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(filter.QuestionType))
        {
            var questionType = ParseQuestionType(filter.QuestionType);
            query = query.Where(t => t.TestQuestions.Any(tq => tq.Question.Type == questionType));
        }

        query = filter.Sort.Trim().ToLowerInvariant() switch
        {
            "oldest" => query.OrderBy(t => t.CreatedAt),
            "most_used" => query.OrderByDescending(t => t.CandidateCount),
            "points" => query.OrderByDescending(t => t.TestQuestions.Sum(tq => tq.Question.Points)),
            _ => query.OrderByDescending(t => t.CreatedAt)
        };

        var totalCount = await query.CountAsync(cancellationToken);
        var rawItems = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Description,
                t.Discipline,
                t.Status,
                t.MaxAttempts,
                t.AllowSkipping,
                t.AllowBacktracking,
                t.ShowProgressBar,
                t.RandomizeOrder,
                t.EnableProctoring,
                t.EnableActivityMonitoring,
                t.RestrictCopyPaste,
                t.PassingThreshold,
                t.CandidateCount,
                t.CreatedAt,
                QuestionCount = t.TestQuestions.Count,
                QuestionTypes = t.TestQuestions.Select(tq => tq.Question.Type).ToList(),
            })
            .ToListAsync(cancellationToken);

        var result = new PagedResultDto<TestDto>
        {
            Items = rawItems.Select(t => new TestDto
            {
                Id = t.Id.ToString(),
                Title = t.Title,
                Description = t.Description,
                Discipline = t.Discipline.ToString(),
                Status = t.Status.ToString(),
                QuestionTypes = t.QuestionTypes.Select(ToContract).Distinct().OrderBy(x => x).ToList(),
                MaxAttempts = t.MaxAttempts,
                AllowSkipping = t.AllowSkipping,
                AllowBacktracking = t.AllowBacktracking,
                ShowProgressBar = t.ShowProgressBar,
                RandomizeOrder = t.RandomizeOrder,
                EnableProctoring = t.EnableProctoring,
                EnableActivityMonitoring = t.EnableActivityMonitoring,
                RestrictCopyPaste = t.RestrictCopyPaste,
                PassingThreshold = t.PassingThreshold,
                CandidateCount = t.CandidateCount,
                QuestionCount = t.QuestionCount,
                CreatedAt = t.CreatedAt == default ? DateTime.UtcNow.ToString("O") : t.CreatedAt.ToString("O"),
            }).ToList(),
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize),
            Page = filter.Page,
            PageSize = filter.PageSize
        };

        if (isSimpleStatusQuery)
        {
            try
            {
                var serialized = JsonSerializer.Serialize(result);
                await cache.SetStringAsync(TestsCacheKey(filter.Status!), serialized, CacheOptions, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Cache write failed for status '{Status}'; result served without caching.", filter.Status);
            }
        }

        return result;
    }

    public async Task<TestDto> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var test = await dbContext.Tests
            .AsNoTracking()
            .Include(t => t.TestQuestions)
            .ThenInclude(tq => tq.Question)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (test is null)
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);

        return MapToDto(test);
    }

    public async Task<TestDto> CreateAsync(CreateTestDto request, CancellationToken cancellationToken)
    {
        ValidateRequest(request);

        var test = new Test
        {
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? string.Empty : request.Description.Trim(),
            Discipline = ParseDiscipline(request.Discipline),
            Status = string.IsNullOrWhiteSpace(request.Status) ? TestStatus.Draft : ParseStatus(request.Status),
            MaxAttempts = request.MaxAttempts,
            AllowSkipping = request.AllowSkipping ?? false,
            AllowBacktracking = request.AllowBacktracking ?? true,
            ShowProgressBar = request.ShowProgressBar ?? true,
            RandomizeOrder = request.RandomizeOrder ?? false,
            EnableProctoring = request.EnableProctoring ?? false,
            EnableActivityMonitoring = request.EnableActivityMonitoring ?? false,
            RestrictCopyPaste = request.RestrictCopyPaste ?? false,
            PassingThreshold = request.PassingThreshold,
            CandidateCount = 0
        };

        dbContext.Tests.Add(test);
        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidateTestsCacheAsync(cancellationToken);

        return MapToDto(test);
    }

    public async Task<TestDto> UpdateAsync(Guid id, UpdateTestDto request, CancellationToken cancellationToken)
    {
        ValidateRequest(request);

        var test = await dbContext.Tests
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (test is null)
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);

        test.Title = request.Title.Trim();
        test.Description = string.IsNullOrWhiteSpace(request.Description) ? string.Empty : request.Description.Trim();
        test.Discipline = ParseDiscipline(request.Discipline);
        test.Status = string.IsNullOrWhiteSpace(request.Status) ? test.Status : ParseStatus(request.Status);
        test.MaxAttempts = request.MaxAttempts;
        test.AllowSkipping = request.AllowSkipping ?? test.AllowSkipping;
        test.AllowBacktracking = request.AllowBacktracking ?? test.AllowBacktracking;
        test.ShowProgressBar = request.ShowProgressBar ?? test.ShowProgressBar;
        test.RandomizeOrder = request.RandomizeOrder ?? test.RandomizeOrder;
        test.EnableProctoring = request.EnableProctoring ?? test.EnableProctoring;
        test.EnableActivityMonitoring = request.EnableActivityMonitoring ?? test.EnableActivityMonitoring;
        test.RestrictCopyPaste = request.RestrictCopyPaste ?? test.RestrictCopyPaste;
        test.PassingThreshold = request.PassingThreshold ?? test.PassingThreshold;

        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidateTestsCacheAsync(cancellationToken);

        // Re-query with navigations for consistent DTO shape without over-fetching in the update query.
        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var test = await dbContext.Tests.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (test is null)
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);

        dbContext.Tests.Remove(test);
        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidateTestsCacheAsync(cancellationToken);
    }

    private static void ValidatePaging(int page, int pageSize)
    {
        if (page <= 0 || pageSize <= 0)
            throw new ApiException("Invalid pagination values.", StatusCodes.Status400BadRequest);
    }

    private static void ValidateRequest(CreateTestDto request)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(request.Title))
            errors.Add("title is required.");
        else if (request.Title.Length > 200)
            errors.Add("title max length is 200.");

        if (string.IsNullOrWhiteSpace(request.Discipline))
            errors.Add("discipline is required.");

        if (request.MaxAttempts.HasValue && request.MaxAttempts.Value < 0)
            errors.Add("maxAttempts must be 0 or greater.");

        if (request.PassingThreshold.HasValue && request.PassingThreshold.Value is < 0 or > 100)
            errors.Add("passingThreshold must be between 0 and 100.");

        if (errors.Count > 0)
            throw new ApiException("Validation failed.", StatusCodes.Status400BadRequest, errors);
    }

    private static TestDto MapToDto(Test test)
    {
        var questionTypes = test.TestQuestions
            .Select(tq => ToContract(tq.Question.Type))
            .Distinct()
            .OrderBy(value => value)
            .ToList();

        return new TestDto
        {
            Id = test.Id.ToString(),
            Title = test.Title,
            Description = test.Description,
            Discipline = test.Discipline.ToString(),
            Status = test.Status.ToString(),
            QuestionTypes = questionTypes,
            MaxAttempts = test.MaxAttempts,
            AllowSkipping = test.AllowSkipping,
            AllowBacktracking = test.AllowBacktracking,
            ShowProgressBar = test.ShowProgressBar,
            RandomizeOrder = test.RandomizeOrder,
            EnableProctoring = test.EnableProctoring,
            EnableActivityMonitoring = test.EnableActivityMonitoring,
            RestrictCopyPaste = test.RestrictCopyPaste,
            PassingThreshold = test.PassingThreshold,
            CandidateCount = test.CandidateCount,
            QuestionCount = test.TestQuestions.Count,
            CreatedAt = test.CreatedAt == default ? DateTime.UtcNow.ToString("O") : test.CreatedAt.ToString("O")
        };
    }

    private static Discipline ParseDiscipline(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ApiException("Discipline is required.", StatusCodes.Status400BadRequest);

        return value.Trim() switch
        {
            "Engineering" => Discipline.Engineering,
            "Design" => Discipline.Design,
            "Product" => Discipline.Product,
            "Data" => Discipline.Data,
            "Marketing" => Discipline.Marketing,
            "Sales" => Discipline.Sales,
            "Operations" => Discipline.Operations,
            "Finance" => Discipline.Finance,
            "HR" => Discipline.HR,
            _ => throw new ApiException($"Invalid Discipline value '{value}'.", StatusCodes.Status400BadRequest)
        };
    }

    private static TestStatus ParseStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ApiException("TestStatus is required.", StatusCodes.Status400BadRequest);

        return value.Trim() switch
        {
            "Active" => TestStatus.Active,
            "Draft" => TestStatus.Draft,
            "Archived" => TestStatus.Archived,
            _ => throw new ApiException($"Invalid TestStatus value '{value}'.", StatusCodes.Status400BadRequest)
        };
    }

    private static QuestionType ParseQuestionType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ApiException("QuestionType is required.", StatusCodes.Status400BadRequest);

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

}