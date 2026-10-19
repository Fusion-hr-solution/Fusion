using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using static EY.HRPlatform.Performance.Tests.TestHelpers.ReviewWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Peer input (D-18, D-R4, D-R5): nominations, approval with a swap, the peer's own page, closure and suggestions.</summary>
public sealed class PeerInputTests
{
    private static uint Version(ReviewWorld world, Guid reviewId)
    {
        using var db = world.Factory.Store.NewContext();
        return db.PerformanceReviews.Single(r => r.Id == reviewId).Version;
    }

    private static Task<HttpResponseMessage> Nominate(ReviewWorld world, HttpClient client, Guid reviewId, params Guid[] ids)
        => client.PutAsJsonAsync($"/api/performance/reviews/{reviewId}/peers", new { expectedVersion = Version(world, reviewId), employeeIds = ids });

    private static Task<HttpResponseMessage> Approve(ReviewWorld world, HttpClient client, Guid reviewId, params Guid[] ids)
        => client.PostAsJsonAsync($"/api/performance/reviews/{reviewId}/peers/approve", new { expectedVersion = Version(world, reviewId), employeeIds = ids });

    private static async Task<(ReviewWorld World, Guid Review)> LaunchedAsync(bool peers = true)
    {
        var world = await CreateAsync();
        var round = await world.CreateRoundAsync(peers: peers);
        await world.LaunchAsync(round);
        return (world, world.ReviewOf(round, world.Aicha));
    }

    [Fact]
    public async Task The_person_nominates_one_to_five_active_colleagues_who_are_not_themselves_or_their_reviewer()
    {
        var (world, reviewId) = await LaunchedAsync();
        await using var _ = world;
        var aicha = world.As(world.Aicha);
        Assert.Equal(HttpStatusCode.BadRequest, (await Failure(await Nominate(world, aicha, reviewId, world.Mariam.EmployeeId))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Failure(await Nominate(world, aicha, reviewId, world.Aicha.EmployeeId))).Status);
        var others = Enumerable.Range(0, 6).Select(i => world.Factory.Core.Add($"Colleague {i}").EmployeeId).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await Failure(await Nominate(world, aicha, reviewId, others))).Status);
        var gone = world.Factory.Core.Add("Gone Colleague", isActive: false);
        Assert.Equal(HttpStatusCode.BadRequest, (await Failure(await Nominate(world, aicha, reviewId, gone.EmployeeId))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Failure(await Nominate(world, world.As(world.Fares), reviewId, world.Leila.EmployeeId))).Status);

        var peers = await Data(await Nominate(world, aicha, reviewId, world.Fares.EmployeeId, world.Khaled.EmployeeId, world.Leila.EmployeeId));
        Assert.Equal(3, peers.GetProperty("people").GetArrayLength());
        Assert.False(peers.GetProperty("approved").GetBoolean());
        // Changing the list before approval doesn't tell the reviewer again.
        await Data(await Nominate(world, aicha, reviewId, world.Fares.EmployeeId, world.Khaled.EmployeeId));
        await using var db = world.Factory.Store.NewContext();
        Assert.Equal(2, db.PeerNominations.Count(n => n.ReviewId == reviewId));
        var notice = Assert.Single(db.Notifications.Where(n => n.Kind == PerformanceNotificationKind.PeersNominated).ToList());
        Assert.Equal(world.Mariam.EmployeeId, notice.RecipientEmployeeId);
        Assert.Contains(db.AuditEntries, a => a.Action == "Review.PeersNominated");
    }

    [Fact]
    public async Task Nominating_is_refused_when_the_round_does_not_ask_for_peer_input()
    {
        var (world, reviewId) = await LaunchedAsync(peers: false);
        await using var _ = world;
        var refused = await Failure(await Nominate(world, world.As(world.Aicha), reviewId, world.Leila.EmployeeId));
        Assert.Equal(HttpStatusCode.Conflict, refused.Status);
    }

    [Fact]
    public async Task The_reviewer_approves_with_a_swap_and_each_approved_peer_gets_a_request()
    {
        var (world, reviewId) = await LaunchedAsync();
        await using var _ = world;
        await Data(await Nominate(world, world.As(world.Aicha), reviewId, world.Fares.EmployeeId, world.Khaled.EmployeeId, world.Leila.EmployeeId));
        Assert.Equal(HttpStatusCode.Forbidden,
            (await Failure(await Approve(world, world.As(world.Fares), reviewId, world.Fares.EmployeeId))).Status);
        var approved = await Data(await Approve(world, world.As(world.Mariam), reviewId,
            world.Fares.EmployeeId, world.Khaled.EmployeeId, world.Tarek.EmployeeId));
        Assert.True(approved.GetProperty("approved").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict,
            (await Failure(await Approve(world, world.As(world.Mariam), reviewId, world.Fares.EmployeeId))).Status);

        await using var db = world.Factory.Store.NewContext();
        var requested = db.PeerRequests.Where(r => r.ReviewId == reviewId).Select(r => r.PeerEmployeeId).ToHashSet();
        Assert.Equal(new[] { world.Fares.EmployeeId, world.Khaled.EmployeeId, world.Tarek.EmployeeId }.ToHashSet(), requested);
        Assert.All(db.PeerRequests.Where(r => r.ReviewId == reviewId).ToList(), r => Assert.Equal(Today.AddDays(14), r.DueDate));
        var audit = db.AuditEntries.Single(a => a.Action == "Review.PeerListApproved");
        Assert.Contains(world.Leila.EmployeeId.ToString(), audit.Summary);
        Assert.Contains(world.Tarek.EmployeeId.ToString(), audit.Summary);
        Assert.Single(db.Notifications.Where(n => n.Kind == PerformanceNotificationKind.PeerListApproved && n.RecipientEmployeeId == world.Aicha.EmployeeId));
        Assert.Equal(3, db.Notifications.Count(n => n.Kind == PerformanceNotificationKind.PeerInputRequested));
        Assert.DoesNotContain(db.Notifications.ToList(), n => n.RecipientEmployeeId == world.Leila.EmployeeId);
    }

    [Fact]
    public async Task A_peer_answers_or_declines_on_their_own_page_and_never_sees_the_review()
    {
        var (world, reviewId) = await LaunchedAsync();
        await using var _ = world;
        await Data(await Nominate(world, world.As(world.Aicha), reviewId, world.Fares.EmployeeId, world.Khaled.EmployeeId, world.Leila.EmployeeId));
        await Data(await Approve(world, world.As(world.Mariam), reviewId, world.Fares.EmployeeId, world.Khaled.EmployeeId, world.Leila.EmployeeId));
        Guid RequestOf(WorkforceSnapshot peer) { using var db = world.Factory.Store.NewContext(); return db.PeerRequests.Single(r => r.ReviewId == reviewId && r.PeerEmployeeId == peer.EmployeeId).Id; }
        var faresRequest = RequestOf(world.Fares);
        var fares = world.As(world.Fares);

        var page = await Data(await fares.GetAsync($"/api/performance/peer-requests/{faresRequest}"));
        Assert.Equal("Aicha Ben Ali", page.GetProperty("subjectDisplayName").GetString());
        var questions = page.GetProperty("questions").EnumerateArray().Select(q => q.GetProperty("questionId").GetGuid()).ToArray();
        Assert.Equal(2, questions.Length);
        Assert.DoesNotContain("Khaled", page.GetRawText());
        Assert.DoesNotContain("Assessment", page.GetRawText());
        Assert.Equal(HttpStatusCode.NotFound, (await Failure(await world.As(world.Khaled).GetAsync($"/api/performance/peer-requests/{faresRequest}"))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Failure(await world.Admin.GetAsync($"/api/performance/peer-requests/{faresRequest}"))).Status);
        using var foreign = world.Factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), employeeId: world.Fares.EmployeeId,
            permissions: [new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self), new(PerformancePermissions.CycleView, PermissionScopes.Self)]);
        Assert.Equal(HttpStatusCode.NotFound, (await Failure(await foreign.GetAsync($"/api/performance/peer-requests/{faresRequest}"))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Failure(await fares.GetAsync($"/api/performance/reviews/{reviewId}"))).Status);

        var draft = await Data(await fares.PutAsJsonAsync($"/api/performance/peer-requests/{faresRequest}",
            new { answers = new[] { new { questionId = questions[0], text = "She makes hard calls kindly." } } }));
        Assert.Equal("She makes hard calls kindly.", draft.GetProperty("questions")[0].GetProperty("answer").GetString());
        var empty = await Failure(await fares.PostAsJsonAsync($"/api/performance/peer-requests/{faresRequest}/send",
            new { answers = new[] { new { questionId = questions[1], text = "" } } }));
        Assert.Equal(HttpStatusCode.BadRequest, empty.Status);
        Assert.Equal(questions[1], empty.Body.GetProperty("details").GetProperty("extra").GetProperty("questions")[0].GetGuid());
        var tooLong = await Failure(await fares.PutAsJsonAsync($"/api/performance/peer-requests/{faresRequest}",
            new { answers = new[] { new { questionId = questions[1], text = new string('a', 2001) } } }));
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.Status);
        // A day late is still accepted: due dates are advisory.
        await using (var db = world.Factory.Store.NewContext())
        {
            var request = db.PeerRequests.Single(r => r.Id == faresRequest);
            db.Entry(request).Property(r => r.DueDate).CurrentValue = Today.AddDays(-1);
            await db.SaveChangesAsync();
        }
        var sent = await Data(await fares.PostAsJsonAsync($"/api/performance/peer-requests/{faresRequest}/send",
            new { answers = new[] { new { questionId = questions[1], text = "Share drafts earlier." } } }));
        Assert.Equal("Answered", sent.GetProperty("state").GetString());
        Assert.False(sent.GetProperty("canAnswer").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await Failure(await fares.PostAsJsonAsync($"/api/performance/peer-requests/{faresRequest}/send",
            new { answers = new[] { new { questionId = questions[1], text = "Changed" } } }))).Status);

        var declined = await Data(await world.As(world.Khaled).PostAsJsonAsync($"/api/performance/peer-requests/{RequestOf(world.Khaled)}/decline",
            new { note = "Haven't worked with Aicha since March" }));
        Assert.Equal("Declined", declined.GetProperty("state").GetString());

        var subject = await Data(await world.As(world.Aicha).GetAsync($"/api/performance/reviews/{reviewId}"));
        var asked = subject.GetProperty("peers").GetProperty("people").EnumerateArray().ToList();
        Assert.Equal(3, asked.Count);
        Assert.DoesNotContain("since March", subject.GetRawText());
        Assert.DoesNotContain("hard calls", subject.GetRawText());
        Assert.All(asked, p => Assert.Equal(JsonValueKind.Null, p.GetProperty("state").ValueKind));
        var reviewer = await Data(await world.As(world.Mariam).GetAsync($"/api/performance/reviews/{reviewId}"));
        var people = reviewer.GetProperty("peers").GetProperty("people").EnumerateArray().ToList();
        Assert.Equal("Haven't worked with Aicha since March", people.Single(p => p.GetProperty("employeeId").GetGuid() == world.Khaled.EmployeeId)
            .GetProperty("declineNote").GetString());
        Assert.Equal("Fares Jaziri", people.Single(p => p.GetProperty("state").GetString() == "Answered").GetProperty("displayName").GetString());
        await using (var db = world.Factory.Store.NewContext())
        {
            Assert.Single(db.Notifications.Where(n => n.Kind == PerformanceNotificationKind.PeerDeclined && n.RecipientEmployeeId == world.Mariam.EmployeeId));
            Assert.DoesNotContain(db.AuditEntries.ToList(), a => a.Summary.Contains("since March") || a.Summary.Contains("hard calls"));
        }

        // Once the reviewer submits, Leila's unanswered request closes and late answers are refused.
        var review = await Data(await world.As(world.Aicha).GetAsync($"/api/performance/reviews/{reviewId}"));
        await Data(await world.As(world.Aicha).PostAsJsonAsync($"/api/performance/reviews/{reviewId}/self-assessment", new
        {
            expectedVersion = review.GetProperty("version").GetUInt32(), summary = "Done", overallRating = 4,
            answers = review.GetProperty("questions").EnumerateArray().Where(q => q.GetProperty("audience").GetString() == "Person")
                .Select(q => new { questionId = q.GetProperty("questionId").GetGuid(), text = "An answer" }).ToArray(),
        }));
        var manager = await Data(await world.As(world.Mariam).GetAsync($"/api/performance/reviews/{reviewId}"));
        await Data(await world.As(world.Mariam).PostAsJsonAsync($"/api/performance/reviews/{reviewId}/manager-assessment", new
        {
            expectedVersion = manager.GetProperty("version").GetUInt32(), summary = "Strong", overallRating = 4, potential = "Growing",
            answers = manager.GetProperty("questions").EnumerateArray().Where(q => q.GetProperty("audience").GetString() == "Manager")
                .Select(q => new { questionId = q.GetProperty("questionId").GetGuid(), text = "An answer" }).ToArray(),
        }));
        var late = await Failure(await world.As(world.Leila).PostAsJsonAsync($"/api/performance/peer-requests/{RequestOf(world.Leila)}/send",
            new { answers = questions.Select(id => new { questionId = id, text = "Too late" }).ToArray() }));
        Assert.Equal(HttpStatusCode.Conflict, late.Status);
        Assert.Equal("PeerRequest.Closed", late.Code);
    }

    [Fact]
    public async Task Suggestions_rank_colleagues_by_the_persons_year_and_leave_out_the_reviewer_and_inactive_people()
    {
        var (world, reviewId) = await LaunchedAsync();
        await using var _ = world;
        var gone = world.Factory.Core.Add("Gone Colleague", isActive: false);
        await using (var db = world.Factory.Store.NewContext())
        {
            var tenant = world.Factory.Store.TenantId;
            var now = DateTime.UtcNow.AddDays(-10);
            Feedback Give(WorkforceSnapshot from, WorkforceSnapshot to)
                => Feedback.Give(Guid.NewGuid(), tenant, from.EmployeeId, from.DisplayName, to.EmployeeId, to.DisplayName,
                    FeedbackVisibility.Shared, null, null, FeedbackSubject.None, "Thanks for the help on the launch.", now);
            for (var i = 0; i < 3; i++) db.Add(Give(world.Leila, world.Aicha));
            for (var i = 0; i < 3; i++) db.Add(Give(world.Aicha, world.Leila));
            db.Add(Give(world.Khaled, world.Aicha));
            db.Add(Give(world.Mariam, world.Aicha));
            db.Add(Give(gone, world.Aicha));
            db.Add(Praise.Give(Guid.NewGuid(), tenant, world.Tarek.EmployeeId, world.Tarek.DisplayName, Guid.NewGuid(), "Great demo",
                [(world.Aicha.EmployeeId, world.Aicha.DisplayName)], now));
            // Manager-only feedback addressed to someone other than the reviewer: not hers to see, so it doesn't count.
            db.Add(Feedback.Give(Guid.NewGuid(), tenant, world.Fares.EmployeeId, world.Fares.DisplayName, world.Aicha.EmployeeId,
                world.Aicha.DisplayName, FeedbackVisibility.ManagerOnly, world.Amira.EmployeeId, world.Amira.DisplayName, FeedbackSubject.None,
                "For Amira only", now));
            // Outside the review period: doesn't count.
            db.Add(Feedback.Give(Guid.NewGuid(), tenant, world.Fares.EmployeeId, world.Fares.DisplayName, world.Aicha.EmployeeId,
                world.Aicha.DisplayName, FeedbackVisibility.Shared, null, null, FeedbackSubject.None, "Old note", DateTime.UtcNow.AddDays(-400)));
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await Failure(await world.As(world.Fares).GetAsync($"/api/performance/reviews/{reviewId}/peer-suggestions"))).Status);
        var suggestions = (await Data(await world.As(world.Mariam).GetAsync($"/api/performance/reviews/{reviewId}/peer-suggestions"))).EnumerateArray().ToList();
        Assert.Equal(new[] { "Leila Ben Salah", "Khaled Sassi", "Tarek Ayari" }, suggestions.Select(s => s.GetProperty("displayName").GetString()));
        Assert.Equal(6, suggestions[0].GetProperty("feedbackExchanged").GetInt32());
        Assert.Equal(1, suggestions[2].GetProperty("praiseExchanged").GetInt32());
        Assert.DoesNotContain(suggestions, s => s.GetProperty("employeeId").GetGuid() == world.Fares.EmployeeId);

        await Data(await Nominate(world, world.As(world.Aicha), reviewId, world.Leila.EmployeeId));
        var after = (await Data(await world.As(world.Mariam).GetAsync($"/api/performance/reviews/{reviewId}/peer-suggestions"))).EnumerateArray();
        Assert.DoesNotContain(after, s => s.GetProperty("employeeId").GetGuid() == world.Leila.EmployeeId);
    }
}
