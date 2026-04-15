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

public class CandidateAccessRoutesIntegrationTests
{
    [Fact]
    public async Task StartAndSubmit_WhenTokenUsedAfterSubmission_ReturnsConflict()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var invitation = await CreateInvitationAsync(client, testId, "single-use@example.com");
        var token = ExtractToken(invitation.InviteLink);

        var startResponse = await client.PostAsJsonAsync("/api/interview/candidate-access/start", new { token });
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var submitResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/submit",
            new
            {
                token,
                answers = new
                {
                    responses = new[]
                    {
                        new { questionId = "q1", answerText = "answer" }
                    }
                },
                result = new { score = 80 }
            });
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var reuseResponse = await client.PostAsJsonAsync("/api/interview/candidate-access/start", new { token });
        Assert.Equal(HttpStatusCode.Conflict, reuseResponse.StatusCode);
    }

    [Fact]
    public async Task Start_WhenTokenExpired_ReturnsGone()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var invitation = await CreateInvitationAsync(client, testId, "expired-route@example.com");
        var invitationId = Guid.Parse(invitation.Id);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitationEntity = await db.CandidateInvitations.FindAsync(invitationId);
            Assert.NotNull(invitationEntity);
            invitationEntity!.TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var token = ExtractToken(invitation.InviteLink);
        var response = await client.PostAsJsonAsync("/api/interview/candidate-access/start", new { token });

        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
    }

    private static async Task<CandidateInvitationEnvelope> CreateInvitationAsync(HttpClient client, Guid testId, string email)
    {
        var response = await client.PostAsJsonAsync(
            "/api/interview/candidates/invitations",
            new
            {
                testId = testId.ToString(),
                email,
                candidateName = "Route Candidate",
                sendNotification = false
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");

        return new CandidateInvitationEnvelope
        {
            Id = data.GetProperty("id").GetString() ?? string.Empty,
            InviteLink = data.GetProperty("inviteLink").GetString() ?? string.Empty,
        };
    }

    private static async Task<Guid> SeedTestAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var test = new Test
        {
            Title = "Candidate access integration test",
            Description = "Secure link route coverage",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 0
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();

        return test.Id;
    }

    private static string ExtractToken(string inviteLink)
    {
        var uri = new Uri(inviteLink);
        var query = uri.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var pair in query)
        {
            if (pair.StartsWith("token=", StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(pair["token=".Length..]);
            }
        }

        throw new InvalidOperationException("Token not found in invite link.");
    }

    private sealed class CandidateInvitationEnvelope
    {
        public string Id { get; set; } = string.Empty;
        public string InviteLink { get; set; } = string.Empty;
    }
}
