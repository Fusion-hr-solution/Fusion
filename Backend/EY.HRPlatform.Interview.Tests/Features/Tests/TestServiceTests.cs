using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Tests;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Tests;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Interview.Tests.Features.Tests;

public class TestServiceTests
{
    private static TestService CreateService(AppDbContext db) =>
        new(db,
            new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions())),
            NullLogger<TestService>.Instance);

    [Fact]
    public async Task CreateAsync_WhenValidRequest_SetsDefaultsAndPersists()
    {
        await using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var request = new CreateTestDto
        {
            Title = "Backend Screening",
            Description = "Core interview test",
            Discipline = "Engineering"
        };

        var created = await service.CreateAsync(request, CancellationToken.None);

        Assert.False(string.IsNullOrWhiteSpace(created.Id));
        Assert.Equal("Draft", created.Status);
        Assert.Equal(0, created.CandidateCount);
        Assert.Equal(1, db.Tests.Count());
    }

    [Fact]
    public async Task CreateAsync_WhenTitleMissing_Throws400()
    {
        await using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var request = new CreateTestDto
        {
            Title = string.Empty,
            Description = "Desc",
            Discipline = "Engineering"
        };

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
        Assert.Contains(ex.Errors, e => e.Contains("title is required", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetAsync_AppliesFiltersAndSortByPoints()
    {
        await using var db = TestDbContextFactory.Create();

        var q1 = new Question
        {
            Title = "Easy SQL",
            Description = "SQL basics",
            Type = QuestionType.Sql,
            Difficulty = Difficulty.Easy,
            GradingMethod = GradingMethod.Manual,
            Points = 10,
            DurationMinutes = 10,
            UsageCount = 1
        };
        q1.SetCreatedAt(DateTime.UtcNow.AddDays(-2));

        var q2 = new Question
        {
            Title = "Hard coding",
            Description = "Algorithm challenge",
            Type = QuestionType.Coding,
            Difficulty = Difficulty.Hard,
            GradingMethod = GradingMethod.Hybrid,
            Points = 40,
            DurationMinutes = 30,
            UsageCount = 2
        };
        q2.SetCreatedAt(DateTime.UtcNow.AddDays(-1));

        var t1 = new Test
        {
            Title = "Engineering SQL",
            Description = "SQL test",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 5,
            TestQuestions = [new TestQuestion { Question = q1 }]
        };
        t1.SetCreatedAt(DateTime.UtcNow.AddDays(-2));

        var t2 = new Test
        {
            Title = "Engineering Coding",
            Description = "Coding test",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Draft,
            CandidateCount = 3,
            TestQuestions = [new TestQuestion { Question = q2 }]
        };
        t2.SetCreatedAt(DateTime.UtcNow.AddDays(-1));

        db.Tests.AddRange(t1, t2);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var filter = new TestFilterDto
        {
            Search = "Engineering",
            Discipline = "Engineering",
            QuestionType = "Coding",
            Sort = "points",
            Page = 1,
            PageSize = 10
        };

        var result = await service.GetAsync(filter, CancellationToken.None);

        Assert.Single(result.Items);
        Assert.Equal("Engineering Coding", result.Items[0].Title);
        Assert.Equal("Draft", result.Items[0].Status);
        Assert.Equal(1, result.Items[0].QuestionCount);
        Assert.Contains("Coding", result.Items[0].QuestionTypes);
    }

    [Fact]
    public async Task UpdateAsync_WhenTestMissing_Throws404()
    {
        await using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var request = new UpdateTestDto
        {
            Title = "Updated",
            Description = "Updated",
            Discipline = "Engineering",
            Status = "Active"
        };

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, ex.StatusCode);
        Assert.Contains("Test not found", ex.Message);
    }
}