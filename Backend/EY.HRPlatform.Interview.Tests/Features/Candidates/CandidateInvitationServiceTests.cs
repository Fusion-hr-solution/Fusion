using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using System.Globalization;

namespace EY.HRPlatform.Interview.Tests.Features.Candidates;

public class CandidateInvitationServiceTests
{
    [Fact]
    public async Task CreateBulkAsync_WhenCandidateEntriesProvided_UsesPerEmailNameAndFallback()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var service = CreateService(db);

        var request = new CreateBulkCandidateInvitationsDto
        {
            TestId = test.Id.ToString(),
            Emails = ["alice@example.com", "bob@example.com"],
            Candidates =
            [
                new CreateCandidateInvitationEntryDto
                {
                    Email = "alice@example.com",
                    CandidateName = "Alice Smith"
                },
                new CreateCandidateInvitationEntryDto
                {
                    Email = "bob@example.com",
                    CandidateName = "  "
                }
            ],
            CandidateName = "Fallback Name",
            InviteMethod = "bulk",
            SendNotification = false
        };

        var created = await service.CreateBulkAsync(request, CancellationToken.None);

        Assert.Equal(2, created.Count);
        var createdByEmail = created.ToDictionary(item => item.Email, StringComparer.OrdinalIgnoreCase);
        Assert.Equal("Alice Smith", createdByEmail["alice@example.com"].CandidateName);
        Assert.Equal("Fallback Name", createdByEmail["bob@example.com"].CandidateName);
    }

    [Fact]
    public async Task CreateBulkAsync_WhenEmailsMissing_UsesCandidateEntryEmails()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var service = CreateService(db);

        var request = new CreateBulkCandidateInvitationsDto
        {
            TestId = test.Id.ToString(),
            Emails = [],
            Candidates =
            [
                new CreateCandidateInvitationEntryDto
                {
                    Email = "first.person@example.com",
                    CandidateName = "First Person"
                },
                new CreateCandidateInvitationEntryDto
                {
                    Email = "second.person@example.com",
                    CandidateName = "Second Person"
                }
            ],
            InviteMethod = "bulk",
            SendNotification = false
        };

        var created = await service.CreateBulkAsync(request, CancellationToken.None);

        Assert.Equal(2, created.Count);
        Assert.Contains(created, item => item.Email == "first.person@example.com" && item.CandidateName == "First Person");
        Assert.Contains(created, item => item.Email == "second.person@example.com" && item.CandidateName == "Second Person");
    }

    [Fact]
    public async Task CreateBulkAsync_WhenCandidateEntriesHaveDuplicateEmail_PrefersNonEmptyName()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var service = CreateService(db);

        var request = new CreateBulkCandidateInvitationsDto
        {
            TestId = test.Id.ToString(),
            Emails = ["dup@example.com"],
            Candidates =
            [
                new CreateCandidateInvitationEntryDto
                {
                    Email = "dup@example.com",
                    CandidateName = ""
                },
                new CreateCandidateInvitationEntryDto
                {
                    Email = "DUP@example.com",
                    CandidateName = "Name From CSV"
                }
            ],
            CandidateName = "Fallback Name",
            InviteMethod = "bulk",
            SendNotification = false
        };

        var created = await service.CreateBulkAsync(request, CancellationToken.None);

        var invitation = Assert.Single(created);
        Assert.Equal("dup@example.com", invitation.Email);
        Assert.Equal("Name From CSV", invitation.CandidateName);
    }

    [Fact]
    public async Task CreateAsync_WhenLinkExpiryHoursProvided_PersistsConfiguredExpiryWindow()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "expiry@example.com",
                LinkExpiryHours = 24,
                SendNotification = false
            },
            CancellationToken.None);

        Assert.Equal(24, created.LinkExpiryHours);

        var tokenCreatedAt = DateTimeOffset.Parse(created.TokenCreatedAtUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
        var tokenExpiresAt = DateTimeOffset.Parse(created.TokenExpiresAtUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
        var diffHours = (tokenExpiresAt - tokenCreatedAt).TotalHours;

        Assert.InRange(diffHours, 23.99, 24.01);
    }

    [Fact]
    public async Task CreateAsync_WhenLinkExpiryHoursMissing_UsesDefaultExpiryWindow()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "default-expiry@example.com",
                SendNotification = false
            },
            CancellationToken.None);

        Assert.Equal(72, created.LinkExpiryHours);
    }

    private static CandidateInvitationService CreateService(AppDbContext db)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CandidateInvitations:PublicBaseUrl"] = "https://example.test/interview/candidate/start"
            })
            .Build();

        return new CandidateInvitationService(
            db,
            configuration,
            new NoOpEmailSender(),
            NullLogger<CandidateInvitationService>.Instance);
    }

    private static async Task<Test> SeedTestAsync(AppDbContext db)
    {
        var test = new Test
        {
            Title = "Bulk Invite Test",
            Description = "Candidate invitation regression test",
            Discipline = "Engineering",
            Status = TestStatus.Active,
            CandidateCount = 0
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();

        return test;
    }

    private sealed class NoOpEmailSender : ICandidateInvitationEmailSender
    {
        public Task SendInvitationAsync(CandidateInvitationDto invitation, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}