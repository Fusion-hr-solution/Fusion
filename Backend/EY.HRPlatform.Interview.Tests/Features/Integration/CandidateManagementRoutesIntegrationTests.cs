using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Interview.Tests.Features.Integration;

public class CandidateManagementRoutesIntegrationTests
{
    [Fact]
    public async Task GetTimelineCandidates_WhenCandidatesHaveDifferentProgress_ReturnsLatestStatusPerCandidate()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        await CreateInvitationAsync(client, testId, "alpha@example.com", "Alpha Candidate");
        var invitationInProgress = await CreateInvitationAsync(client, testId, "bravo@example.com", "Bravo Candidate");

        var inProgressToken = ExtractToken(invitationInProgress.InviteLink);
        var startResponse = await StartAttemptAsync(client, inProgressToken, "bravo@example.com", "timeline-fingerprint-bravo");
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var response = await client.GetAsync($"/api/interview/candidates/management/timeline/candidates?testId={testId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        var items = json.RootElement.GetProperty("data");
        Assert.Equal(2, items.GetArrayLength());

        Assert.Equal("alpha@example.com", items[0].GetProperty("candidateEmail").GetString());
        Assert.Equal("bravo@example.com", items[1].GetProperty("candidateEmail").GetString());

        var byEmail = items
            .EnumerateArray()
            .ToDictionary(
                item => item.GetProperty("candidateEmail").GetString() ?? string.Empty,
                StringComparer.OrdinalIgnoreCase);

        Assert.Equal("Invited", byEmail["alpha@example.com"].GetProperty("latestStatus").GetString());
        Assert.Equal("InProgress", byEmail["bravo@example.com"].GetProperty("latestStatus").GetString());

        Assert.False(string.IsNullOrWhiteSpace(byEmail["alpha@example.com"].GetProperty("latestActivityAtUtc").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(byEmail["bravo@example.com"].GetProperty("latestActivityAtUtc").GetString()));
    }

    [Fact]
    public async Task GetTimeline_WhenCandidateHasSubmittedAndResumedAttempt_ReturnsPerAttemptMilestones()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        const string candidateEmail = "timeline@example.com";

        var invitation = await CreateInvitationAsync(client, testId, candidateEmail, "Timeline Candidate");
        var firstToken = ExtractToken(invitation.InviteLink);

        var validateResponse = await client.GetAsync($"/api/interview/candidate-access/validate?token={Uri.EscapeDataString(firstToken)}");
        Assert.Equal(HttpStatusCode.OK, validateResponse.StatusCode);

        var firstStartResponse = await StartAttemptAsync(client, firstToken, candidateEmail, "timeline-fingerprint-1");
        Assert.Equal(HttpStatusCode.OK, firstStartResponse.StatusCode);

        var firstSubmitResponse = await SubmitAttemptAsync(client, firstToken, "timeline-fingerprint-1");
        Assert.Equal(HttpStatusCode.OK, firstSubmitResponse.StatusCode);

        await SetInvitationStatusAsync(factory.Services, invitation.Id, "Invited");

        var regenerateResponse = await client.PostAsync(
            $"/api/interview/candidates/management/link-security/{testId}/regenerate",
            content: null);
        Assert.Equal(HttpStatusCode.OK, regenerateResponse.StatusCode);

        using var regenerateJson = JsonDocument.Parse(await regenerateResponse.Content.ReadAsStringAsync());
        var secondInviteLink = regenerateJson.RootElement
            .GetProperty("data")
            .GetProperty("preview")
            .GetProperty("inviteLink")
            .GetString();
        Assert.False(string.IsNullOrWhiteSpace(secondInviteLink));

        var secondToken = ExtractToken(secondInviteLink!);

        var secondStartResponse = await StartAttemptAsync(client, secondToken, candidateEmail, "timeline-fingerprint-2");
        Assert.Equal(HttpStatusCode.OK, secondStartResponse.StatusCode);

        var timelineResponse = await client.GetAsync(
            $"/api/interview/candidates/management/timeline?testId={testId}&candidateEmail={Uri.EscapeDataString(candidateEmail)}");

        Assert.Equal(HttpStatusCode.OK, timelineResponse.StatusCode);

        using var timelineJson = JsonDocument.Parse(await timelineResponse.Content.ReadAsStringAsync());
        Assert.True(timelineJson.RootElement.GetProperty("success").GetBoolean());

        var data = timelineJson.RootElement.GetProperty("data");
        Assert.Equal(candidateEmail, data.GetProperty("candidateEmail").GetString());

        var attempts = data.GetProperty("attempts");
        Assert.Equal(2, attempts.GetArrayLength());

        var firstAttempt = attempts[0];
        Assert.Equal(1, firstAttempt.GetProperty("attemptNumber").GetInt32());
        Assert.Equal("Submitted", firstAttempt.GetProperty("status").GetString());

        var firstMilestones = firstAttempt.GetProperty("milestones");
        AssertMilestoneOrder(firstMilestones);
        Assert.Equal("Completed", GetMilestone(firstMilestones, "Invited").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(firstMilestones, "LinkOpened").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(firstMilestones, "Started").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(firstMilestones, "InProgress").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(firstMilestones, "Submitted").GetProperty("state").GetString());

        Assert.NotNull(GetMilestone(firstMilestones, "InProgress").GetProperty("occurredAtUtc").GetString());

        var firstInvitedAt = ParseRequiredUtc(GetMilestone(firstMilestones, "Invited").GetProperty("occurredAtUtc").GetString());
        var firstLinkOpenedAt = ParseRequiredUtc(GetMilestone(firstMilestones, "LinkOpened").GetProperty("occurredAtUtc").GetString());
        var firstStartedAt = ParseRequiredUtc(GetMilestone(firstMilestones, "Started").GetProperty("occurredAtUtc").GetString());
        var firstSubmittedAt = ParseRequiredUtc(GetMilestone(firstMilestones, "Submitted").GetProperty("occurredAtUtc").GetString());

        Assert.True(firstInvitedAt <= firstLinkOpenedAt);
        Assert.True(firstLinkOpenedAt <= firstStartedAt);
        Assert.True(firstStartedAt <= firstSubmittedAt);

        var secondAttempt = attempts[1];
        Assert.Equal(2, secondAttempt.GetProperty("attemptNumber").GetInt32());
        Assert.Equal("InProgress", secondAttempt.GetProperty("status").GetString());

        var secondMilestones = secondAttempt.GetProperty("milestones");
        AssertMilestoneOrder(secondMilestones);
        Assert.Equal("Completed", GetMilestone(secondMilestones, "Invited").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(secondMilestones, "LinkOpened").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(secondMilestones, "Started").GetProperty("state").GetString());
        Assert.Equal("Completed", GetMilestone(secondMilestones, "InProgress").GetProperty("state").GetString());
        Assert.Equal("Pending", GetMilestone(secondMilestones, "Submitted").GetProperty("state").GetString());

        Assert.NotNull(GetMilestone(secondMilestones, "LinkOpened").GetProperty("occurredAtUtc").GetString());
        Assert.Equal(JsonValueKind.Null, GetMilestone(secondMilestones, "Submitted").GetProperty("occurredAtUtc").ValueKind);
    }

    [Fact]
    public async Task GetTimeline_WhenInvitationEmailStoredWithMixedCase_MatchesCaseInsensitively()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var invitation = await CreateInvitationAsync(client, testId, "case@example.com", "Case Candidate");
        await SetInvitationEmailAsync(factory.Services, invitation.Id, "Case@Example.com");

        var response = await client.GetAsync(
            $"/api/interview/candidates/management/timeline?testId={testId}&candidateEmail={Uri.EscapeDataString("Case@Example.com")}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("case@example.com", json.RootElement.GetProperty("data").GetProperty("candidateEmail").GetString());
    }

    [Fact]
    public async Task GetTimeline_WhenInvitationEmailContainsControlWhitespace_MatchesNormalizedEmail()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var invitation = await CreateInvitationAsync(client, testId, "space@example.com", "Space Candidate");
    await SetInvitationEmailAsync(factory.Services, invitation.Id, "\tSpace@Example.com\r\n");

        var response = await client.GetAsync(
            $"/api/interview/candidates/management/timeline?testId={testId}&candidateEmail={Uri.EscapeDataString("space@example.com")}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("space@example.com", json.RootElement.GetProperty("data").GetProperty("candidateEmail").GetString());
    }

    [Fact]
    public async Task GetAttemptSettings_WhenUnset_ReturnsDefault()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/interview/candidates/management/attempt-settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(0, json.RootElement.GetProperty("data").GetProperty("defaultMaxAttempts").GetInt32());
    }

    [Fact]
    public async Task SaveAttemptSettings_WhenValid_PersistsAndCanBeRetrieved()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var saveResponse = await client.PutAsJsonAsync(
            "/api/interview/candidates/management/attempt-settings",
            new { defaultMaxAttempts = 3 });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        using var saveJson = JsonDocument.Parse(await saveResponse.Content.ReadAsStringAsync());
        Assert.True(saveJson.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(3, saveJson.RootElement.GetProperty("data").GetProperty("defaultMaxAttempts").GetInt32());

        var getResponse = await client.GetAsync("/api/interview/candidates/management/attempt-settings");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        using var getJson = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync());
        Assert.True(getJson.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(3, getJson.RootElement.GetProperty("data").GetProperty("defaultMaxAttempts").GetInt32());
    }

    [Fact]
    public async Task SaveAttemptSettings_WhenNegative_ReturnsBadRequest()
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PutAsJsonAsync(
            "/api/interview/candidates/management/attempt-settings",
            new { defaultMaxAttempts = -1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        var message = json.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("defaultMaxAttempts must be 0 or greater", message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GrantRetake_WhenCandidateExists_CreatesPendingAttemptAndShowsItInTimeline()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        const string candidateEmail = "retake@example.com";
        var invitation = await CreateInvitationAsync(client, testId, candidateEmail, "Retake Candidate");
        var firstToken = ExtractToken(invitation.InviteLink);

        var startResponse = await StartAttemptAsync(client, firstToken, candidateEmail, "retake-fingerprint-1");
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var submitResponse = await SubmitAttemptAsync(client, firstToken, "retake-fingerprint-1");
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var response = await client.PostAsJsonAsync(
            "/api/interview/candidates/management/retake",
            new
            {
                testId = testId.ToString(),
                candidateEmail,
                sendNotification = false,
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var grantJson = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(grantJson.RootElement.GetProperty("success").GetBoolean());
        var grantData = grantJson.RootElement.GetProperty("data");
        Assert.Equal(2, grantData.GetProperty("attemptNumber").GetInt32());
        Assert.Equal("PendingStart", grantData.GetProperty("status").GetString());
        Assert.False(grantData.GetProperty("notificationSent").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(grantData.GetProperty("inviteLink").GetString()));

        var timelineResponse = await client.GetAsync(
            $"/api/interview/candidates/management/timeline?testId={testId}&candidateEmail={Uri.EscapeDataString(candidateEmail)}");

        Assert.Equal(HttpStatusCode.OK, timelineResponse.StatusCode);

        using var timelineJson = JsonDocument.Parse(await timelineResponse.Content.ReadAsStringAsync());
        Assert.True(timelineJson.RootElement.GetProperty("success").GetBoolean());

        var attempts = timelineJson.RootElement.GetProperty("data").GetProperty("attempts");
        Assert.Equal(2, attempts.GetArrayLength());

        var latestAttempt = attempts[1];
        Assert.Equal(2, latestAttempt.GetProperty("attemptNumber").GetInt32());
        Assert.Equal("PendingStart", latestAttempt.GetProperty("status").GetString());

        var milestones = latestAttempt.GetProperty("milestones");
        Assert.Equal("Completed", GetMilestone(milestones, "Invited").GetProperty("state").GetString());
        Assert.Equal("Pending", GetMilestone(milestones, "Started").GetProperty("state").GetString());
        Assert.Equal("Pending", GetMilestone(milestones, "Submitted").GetProperty("state").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var invitationId = Guid.Parse(invitation.Id);

        var createdAttempt = await db.CandidateTestAttempts
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.InvitationId == invitationId && item.AttemptNumber == 2);

        Assert.NotNull(createdAttempt);
        Assert.Equal(default, createdAttempt!.StartedAtUtc);
        Assert.False(createdAttempt.SubmittedAtUtc.HasValue);
    }


    [Fact]
    public async Task GrantRetake_WhenMaxAttemptsReached_ReturnsConflict()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        await SetGlobalMaxAttemptsAsync(factory.Services, 1);

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        const string candidateEmail = "retake-limit@example.com";
        var invitation = await CreateInvitationAsync(client, testId, candidateEmail, "Retake Limit");
        var token = ExtractToken(invitation.InviteLink);

        var startResponse = await StartAttemptAsync(client, token, candidateEmail, "retake-limit-fp-1");
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var submitResponse = await SubmitAttemptAsync(client, token, "retake-limit-fp-1");
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var response = await client.PostAsJsonAsync(
            "/api/interview/candidates/management/retake",
            new
            {
                testId = testId.ToString(),
                candidateEmail,
                sendNotification = false,
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var message = json.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("Maximum attempts reached", message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RegenerateLink_WhenMaxAttemptsReached_ReturnsConflict()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        await SetGlobalMaxAttemptsAsync(factory.Services, 1);

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        const string candidateEmail = "regen-limit@example.com";
        var invitation = await CreateInvitationAsync(client, testId, candidateEmail, "Regen Limit");
        var token = ExtractToken(invitation.InviteLink);

        var startResponse = await StartAttemptAsync(client, token, candidateEmail, "regen-limit-fp-1");
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var submitResponse = await SubmitAttemptAsync(client, token, "regen-limit-fp-1");
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        await SetInvitationStatusAsync(factory.Services, invitation.Id, "Invited");

        var response = await client.PostAsync(
            $"/api/interview/candidates/management/link-security/{testId}/regenerate",
            content: null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var message = json.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("Maximum attempts reached", message, StringComparison.OrdinalIgnoreCase);
    }

    private static void AssertMilestoneOrder(JsonElement milestones)
    {
        var names = milestones
            .EnumerateArray()
            .Select(item => item.GetProperty("name").GetString())
            .ToArray();

        Assert.Equal(new[] { "Invited", "LinkOpened", "Started", "InProgress", "Submitted" }, names);
    }

    private static JsonElement GetMilestone(JsonElement milestones, string name)
    {
        foreach (var milestone in milestones.EnumerateArray())
        {
            if (string.Equals(milestone.GetProperty("name").GetString(), name, StringComparison.Ordinal))
            {
                return milestone.Clone();
            }
        }

        throw new InvalidOperationException($"Milestone '{name}' was not found.");
    }

    private static DateTimeOffset ParseRequiredUtc(string? value)
    {
        Assert.False(string.IsNullOrWhiteSpace(value));

        return DateTimeOffset.Parse(value!, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
    }

    private static Task<HttpResponseMessage> StartAttemptAsync(
        HttpClient client,
        string token,
        string candidateEmail,
        string browserFingerprint)
    {
        return client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail,
                browserFingerprint,
            });
    }

    private static Task<HttpResponseMessage> SubmitAttemptAsync(
        HttpClient client,
        string token,
        string browserFingerprint)
    {
        return client.PostAsJsonAsync(
            "/api/interview/candidate-access/submit",
            new
            {
                token,
                browserFingerprint,
                answers = new
                {
                    responses = new[]
                    {
                        new { questionId = "q1", answerText = "answer" }
                    }
                },
                result = new { score = 80 }
            });
    }

    private static async Task<CandidateInvitationEnvelope> CreateInvitationAsync(
        HttpClient client,
        Guid testId,
        string email,
        string candidateName)
    {
        var response = await client.PostAsJsonAsync(
            "/api/interview/candidates/invitations",
            new
            {
                testId = testId.ToString(),
                email,
                candidateName,
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
            Title = "Candidate management timeline integration test",
            Description = "Timeline API route coverage",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 0
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();

        return test.Id;
    }

    private static async Task SetInvitationStatusAsync(IServiceProvider services, string invitationId, string status)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var parsedInvitationId = Guid.Parse(invitationId);
        var invitation = await db.CandidateInvitations.FindAsync(parsedInvitationId);
        Assert.NotNull(invitation);

        invitation!.Status = status;
        await db.SaveChangesAsync();
    }

    private static async Task SetInvitationEmailAsync(IServiceProvider services, string invitationId, string email)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var parsedInvitationId = Guid.Parse(invitationId);
        var invitation = await db.CandidateInvitations.FindAsync(parsedInvitationId);
        Assert.NotNull(invitation);

        invitation!.Email = email;
        await db.SaveChangesAsync();
    }

    private static async Task SetGlobalMaxAttemptsAsync(IServiceProvider services, int defaultMaxAttempts)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.CandidateAttemptSettings.Add(new CandidateAttemptSettings
        {
            DefaultMaxAttempts = defaultMaxAttempts,
        });

        await db.SaveChangesAsync();
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
