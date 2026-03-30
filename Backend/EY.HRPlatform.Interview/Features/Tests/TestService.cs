using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Tests;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Tests;

public class TestService(AppDbContext dbContext) : ITestService
{
    public async Task<PagedResultDto<TestDto>> GetAsync(TestFilterDto filter, CancellationToken cancellationToken)
    {
        ValidatePaging(filter.Page, filter.PageSize);

        var query = dbContext.Tests
            .AsNoTrackingWithIdentityResolution()
            .Include(t => t.TestQuestions)
            .ThenInclude(tq => tq.Question)
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
        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<TestDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize),
            Page = filter.Page,
            PageSize = filter.PageSize
        };
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
            CandidateCount = 0
        };

        dbContext.Tests.Add(test);
        await dbContext.SaveChangesAsync(cancellationToken);

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
        test.Status = string.IsNullOrWhiteSpace(request.Status) ? TestStatus.Draft : ParseStatus(request.Status);

        await dbContext.SaveChangesAsync(cancellationToken);

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
}