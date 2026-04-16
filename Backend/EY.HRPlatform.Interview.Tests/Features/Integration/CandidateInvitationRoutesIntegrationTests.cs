using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Interview.Tests.Features.Integration;

public class CandidateInvitationRoutesIntegrationTests
{
    [Fact]
    public async Task PostBulkInvitations_WhenCandidatesProvided_PreservesPerEmailCandidateNames()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var request = new
        {
            testId = testId.ToString(),
            emails = new[] { "alice@example.com", "bob@example.com" },
            candidates = new[]
            {
                new { email = "alice@example.com", candidateName = "Alice Name" },
                new { email = "bob@example.com", candidateName = "" }
            },
            candidateName = "Fallback Name",
            inviteMethod = "bulk",
            sendNotification = false
        };

        var response = await client.PostAsJsonAsync("/api/interview/candidates/invitations/bulk", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());

        var data = json.RootElement.GetProperty("data");
        Assert.Equal(2, data.GetArrayLength());

        var itemsByEmail = data
            .EnumerateArray()
            .ToDictionary(
                item => item.GetProperty("email").GetString() ?? string.Empty,
                StringComparer.OrdinalIgnoreCase);

        Assert.Equal("Alice Name", itemsByEmail["alice@example.com"].GetProperty("candidateName").GetString());
        Assert.Equal("Fallback Name", itemsByEmail["bob@example.com"].GetProperty("candidateName").GetString());
    }

    private static async Task<Guid> SeedTestAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var test = new Test
        {
            Title = "Candidate invite API test",
            Description = "Regression coverage for candidate names",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 0
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();

        return test.Id;
    }
}