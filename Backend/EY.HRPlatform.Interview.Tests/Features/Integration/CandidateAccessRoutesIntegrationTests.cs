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

public class CandidateAccessRoutesIntegrationTests
{
    [Fact]
    public async Task Start_WhenInProgressWithinGrace_AllowsResume_AndAfterGrace_ReturnsGone()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = testId,
                SingleUseLinkEnabled = false,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = false,
                LinkValidForValue = 7,
                LinkValidForUnit = "days",
                GracePeriodValue = 5,
                GracePeriodUnit = "minutes",
            });
            await db.SaveChangesAsync();
        }

        var invitation = await CreateInvitationAsync(factory, testId, "grace-route@example.com");
        var invitationId = Guid.Parse(invitation.Id);
        var token = ExtractToken(invitation.InviteLink);

        var firstStartResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "grace-route@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, firstStartResponse.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitationEntity = await db.CandidateInvitations.FindAsync(invitationId);
            Assert.NotNull(invitationEntity);
            invitationEntity!.TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-2);
            await db.SaveChangesAsync();
        }

        var withinGraceResumeResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "grace-route@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, withinGraceResumeResponse.StatusCode);

        using (var withinGraceJson = JsonDocument.Parse(await withinGraceResumeResponse.Content.ReadAsStringAsync()))
        {
            var status = withinGraceJson.RootElement
                .GetProperty("data")
                .GetProperty("status")
                .GetString();
            Assert.Equal("InProgress", status);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitationEntity = await db.CandidateInvitations.FindAsync(invitationId);
            Assert.NotNull(invitationEntity);
            invitationEntity!.TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-7);
            await db.SaveChangesAsync();
        }

        var afterGraceResumeResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "grace-route@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.Gone, afterGraceResumeResponse.StatusCode);

        using (var afterGraceJson = JsonDocument.Parse(await afterGraceResumeResponse.Content.ReadAsStringAsync()))
        {
            var message = afterGraceJson.RootElement.GetProperty("message").GetString() ?? string.Empty;
            Assert.Contains("grace period", message, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Start_WhenSingleUseLinkReopened_BeforeSubmission_ReturnsConflict()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = testId,
                SingleUseLinkEnabled = true,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = false,
                LinkValidForValue = 7,
                LinkValidForUnit = "days",
                GracePeriodValue = 30,
                GracePeriodUnit = "minutes",
            });
            await db.SaveChangesAsync();
        }

        var invitation = await CreateInvitationAsync(factory, testId, "single-use-reopen@example.com");
        var token = ExtractToken(invitation.InviteLink);

        var firstStartResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "single-use-reopen@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, firstStartResponse.StatusCode);

        var validateAfterStartResponse = await client.GetAsync(
            $"/api/interview/candidate-access/validate?token={Uri.EscapeDataString(token)}");
        Assert.Equal(HttpStatusCode.OK, validateAfterStartResponse.StatusCode);

        using (var validateAfterStartJson = JsonDocument.Parse(await validateAfterStartResponse.Content.ReadAsStringAsync()))
        {
            var data = validateAfterStartJson.RootElement.GetProperty("data");
            Assert.False(data.GetProperty("isValid").GetBoolean());
            Assert.Equal("Invalid", data.GetProperty("status").GetString());
            var validateMessage = data.GetProperty("message").GetString() ?? string.Empty;
            Assert.Contains("single-use", validateMessage, StringComparison.OrdinalIgnoreCase);
        }

        var reopenResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "single-use-reopen@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.Conflict, reopenResponse.StatusCode);

        using var reopenJson = JsonDocument.Parse(await reopenResponse.Content.ReadAsStringAsync());
        var reopenMessage = reopenJson.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("single-use", reopenMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Start_WhenBrowserFingerprintEnabled_AllowsSameFingerprint_AndRejectsChangedFingerprint()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = testId,
                SingleUseLinkEnabled = false,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = true,
                LinkValidForValue = 7,
                LinkValidForUnit = "days",
                GracePeriodValue = 30,
                GracePeriodUnit = "minutes",
            });
            await db.SaveChangesAsync();
        }

        var invitation = await CreateInvitationAsync(factory, testId, "fingerprint-route@example.com");
        var token = ExtractToken(invitation.InviteLink);

        var firstStartResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "fingerprint-route@example.com",
                browserFingerprint = "fingerprint-A",
            });
        Assert.Equal(HttpStatusCode.OK, firstStartResponse.StatusCode);

        var resumeSameFingerprintResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "fingerprint-route@example.com",
                browserFingerprint = "fingerprint-A",
            });
        Assert.Equal(HttpStatusCode.OK, resumeSameFingerprintResponse.StatusCode);

        var changedFingerprintResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "fingerprint-route@example.com",
                browserFingerprint = "fingerprint-B",
            });
        Assert.Equal(HttpStatusCode.Conflict, changedFingerprintResponse.StatusCode);

        using var changedFingerprintJson = JsonDocument.Parse(await changedFingerprintResponse.Content.ReadAsStringAsync());
        var changedFingerprintMessage = changedFingerprintJson.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("fingerprint", changedFingerprintMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Start_WhenFingerprintLockRequired_AndFingerprintMissing_ReturnsBadRequest()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = testId,
                SingleUseLinkEnabled = false,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = true,
                LinkValidForValue = 7,
                LinkValidForUnit = "days",
                GracePeriodValue = 30,
                GracePeriodUnit = "minutes",
            });
            await db.SaveChangesAsync();
        }

        var invitation = await CreateInvitationAsync(factory, testId, "fingerprint-missing@example.com");
        var token = ExtractToken(invitation.InviteLink);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/interview/candidate-access/start")
        {
            Content = JsonContent.Create(new
            {
                token,
                candidateEmail = "fingerprint-missing@example.com",
            })
        };
        request.Headers.TryAddWithoutValidation("User-Agent", string.Empty);

        var missingFingerprintResponse = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, missingFingerprintResponse.StatusCode);

        using var missingFingerprintJson = JsonDocument.Parse(await missingFingerprintResponse.Content.ReadAsStringAsync());
        var missingFingerprintMessage = missingFingerprintJson.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("fingerprint", missingFingerprintMessage, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("required", missingFingerprintMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task StartAndSubmit_WhenTokenUsedAfterSubmission_ReturnsConflict()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var invitation = await CreateInvitationAsync(factory, testId, "single-use@example.com");
        var token = ExtractToken(invitation.InviteLink);

        var startResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "single-use@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var submitResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/submit",
            new
            {
                token,
                browserFingerprint = "integration-browser-fingerprint",
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

        var reuseResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "single-use@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.Conflict, reuseResponse.StatusCode);
    }

    [Fact]
    public async Task StartAndSubmit_WhenSingleUseDisabled_AllowsReuseWithSameLink()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = testId,
                SingleUseLinkEnabled = false,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = false,
                LinkValidForValue = 7,
                LinkValidForUnit = "days",
                GracePeriodValue = 30,
                GracePeriodUnit = "minutes",
            });
            await db.SaveChangesAsync();
        }

        var invitation = await CreateInvitationAsync(factory, testId, "reuse-disabled@example.com");
        var invitationId = Guid.Parse(invitation.Id);
        var token = ExtractToken(invitation.InviteLink);

        var firstStartResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "reuse-disabled@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, firstStartResponse.StatusCode);

        var submitResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/submit",
            new
            {
                token,
                browserFingerprint = "integration-browser-fingerprint",
                answers = new
                {
                    responses = new[]
                    {
                        new { questionId = "q1", answerText = "answer" }
                    }
                },
                result = new { score = 81 }
            });
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var reuseResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "reuse-disabled@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, reuseResponse.StatusCode);

        using (var reuseJson = JsonDocument.Parse(await reuseResponse.Content.ReadAsStringAsync()))
        {
            var status = reuseJson.RootElement
                .GetProperty("data")
                .GetProperty("status")
                .GetString();
            Assert.Equal("InProgress", status);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var attempts = await db.CandidateTestAttempts
                .Where(item => item.InvitationId == invitationId)
                .OrderBy(item => item.AttemptNumber)
                .ToListAsync();

            Assert.Equal(2, attempts.Count);
            Assert.True(attempts[0].SubmittedAtUtc.HasValue);
            Assert.False(attempts[1].SubmittedAtUtc.HasValue);
        }
    }

    [Fact]
    public async Task StartAndSubmit_WhenMaxAttemptsReached_ReturnsConflict()
    {
        await using var factory = new InterviewApiFactory();
        var testId = await SeedTestAsync(factory.Services);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        await SetGlobalMaxAttemptsAsync(factory.Services, 1);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = testId,
                SingleUseLinkEnabled = false,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = false,
                LinkValidForValue = 7,
                LinkValidForUnit = "days",
                GracePeriodValue = 30,
                GracePeriodUnit = "minutes",
            });
            await db.SaveChangesAsync();
        }

        var invitation = await CreateInvitationAsync(factory, testId, "reuse-limited@example.com");
        var token = ExtractToken(invitation.InviteLink);

        var startResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "reuse-limited@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var submitResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/submit",
            new
            {
                token,
                browserFingerprint = "integration-browser-fingerprint",
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

        var reuseResponse = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "reuse-limited@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });
        Assert.Equal(HttpStatusCode.Conflict, reuseResponse.StatusCode);

        using var reuseJson = JsonDocument.Parse(await reuseResponse.Content.ReadAsStringAsync());
        var message = reuseJson.RootElement.GetProperty("message").GetString() ?? string.Empty;
        Assert.Contains("Maximum attempts reached", message, StringComparison.OrdinalIgnoreCase);
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

        var invitation = await CreateInvitationAsync(factory, testId, "expired-route@example.com");
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
        var response = await client.PostAsJsonAsync(
            "/api/interview/candidate-access/start",
            new
            {
                token,
                candidateEmail = "expired-route@example.com",
                browserFingerprint = "integration-browser-fingerprint",
            });

        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
    }

    /// <summary>Seeds an invitation the way it really happens: an authenticated ADMIN creates it.
    /// The candidate then uses the returned link anonymously — which is what these tests exercise.
    /// (Creating invitations is a protected route; the candidate client has no token.)</summary>
    private static async Task<CandidateInvitationEnvelope> CreateInvitationAsync(InterviewApiFactory factory, Guid testId, string email)
    {
        using var client = factory.CreateAuthenticatedClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

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
            Discipline = "Engineering",
            Status = TestStatus.Active,
            CandidateCount = 0
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();

        return test.Id;
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
