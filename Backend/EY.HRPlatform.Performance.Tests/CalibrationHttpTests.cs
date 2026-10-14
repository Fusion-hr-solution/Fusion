using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Calibration needs the calibrate grant and a seat on the session; round administration is not enough.</summary>
public sealed class CalibrationHttpTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly EffectivePermissionGrant[] Calibrator =
        [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.ReviewCalibrate, PermissionScopes.Tenant)];
    private static readonly EffectivePermissionGrant[] RoundAdmin =
        [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)];
    private static readonly EffectivePermissionGrant[] Employee =
        [new(PerformancePermissions.CycleView, PermissionScopes.Self), new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)];

    [Fact]
    public async Task Each_role_gets_only_what_calibration_authority_allows()
    {
        using var factory = new PerformanceApiFactory();
        var roundId = await ArrangeAsync(factory);
        var hr = Guid.NewGuid();
        var otherHolder = Guid.NewGuid();
        var path = $"/api/performance/review-rounds/{roundId}/calibration";

        var admin = factory.CreateAuthenticatedClient(permissions: RoundAdmin);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsync(path, null)).StatusCode);
        var employee = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Employee);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync(path)).StatusCode);

        var facilitator = factory.CreateAuthenticatedClient(permissions: Calibrator, userId: hr);
        Assert.Equal(HttpStatusCode.OK, (await facilitator.PostAsync(path, null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await facilitator.GetAsync(path)).StatusCode);

        // Holding the grant is not a seat on the session.
        var unnamed = factory.CreateAuthenticatedClient(permissions: Calibrator, userId: otherHolder);
        Assert.Equal(HttpStatusCode.Forbidden, (await unnamed.GetAsync(path)).StatusCode);

        // Naming someone Identity does not list as a holder is rejected.
        factory.Holders.Holders.Add(new PermissionHolder(hr, null, "QA Admin", "qa@example.test"));
        var session = await facilitator.GetFromJsonAsync<System.Text.Json.JsonElement>(path);
        var version = session.GetProperty("data").GetProperty("version").GetUInt32();
        var naming = await facilitator.PutAsJsonAsync($"{path}/facilitators", new { userIds = new[] { hr, otherHolder }, expectedVersion = version });
        Assert.Equal(HttpStatusCode.BadRequest, naming.StatusCode);
    }

    [Fact]
    public async Task After_calibration_the_reviewer_sees_why_the_rating_changed_and_the_subject_sees_only_the_result()
    {
        using var factory = new PerformanceApiFactory();
        var world = await ArrangeReviewAsync(factory);
        var hr = Guid.NewGuid();
        var calibration = $"/api/performance/review-rounds/{world.RoundId}/calibration";
        var reviewPath = $"/api/performance/reviews/{world.ReviewId}";
        var facilitator = factory.CreateAuthenticatedClient(permissions: [.. Calibrator, .. RoundAdmin], userId: hr);
        var reviewer = factory.CreateAuthenticatedClient(employeeId: world.ReviewerId,
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)]);
        var subject = factory.CreateAuthenticatedClient(employeeId: world.SubjectId, permissions: Employee);
        var unnamed = factory.CreateAuthenticatedClient(permissions: Calibrator, userId: Guid.NewGuid());

        var opened = await Data(await facilitator.PostAsync(calibration, null));
        var subjectVersion = opened.GetProperty("subjects")[0].GetProperty("version").GetUInt32();
        // A named facilitator reads the review while it is in calibration; an unnamed holder cannot.
        var during = await Data(await facilitator.GetAsync(reviewPath));
        Assert.Equal(4, during.GetProperty("calibration").GetProperty("originalRating").GetInt32());
        Assert.Equal(HttpStatusCode.Forbidden, (await unnamed.GetAsync(reviewPath)).StatusCode);
        Assert.Equal(JsonValueKind.Null, (await Data(await reviewer.GetAsync(reviewPath))).GetProperty("calibration").ValueKind);

        Assert.Equal(HttpStatusCode.OK, (await facilitator.PutAsJsonAsync($"{calibration}/subjects/{world.ReviewId}",
            new { rating = 3, rationale = "Peer outcomes were stronger", discussionState = "Discussed", expectedVersion = subjectVersion })).StatusCode);
        var session = await Data(await facilitator.GetAsync(calibration));
        Assert.Equal(HttpStatusCode.OK, (await facilitator.PostAsJsonAsync($"{calibration}/finalize",
            new { expectedVersion = session.GetProperty("version").GetUInt32() })).StatusCode);
        var readyReview = await Data(await facilitator.GetAsync(reviewPath));
        Assert.Equal(HttpStatusCode.OK, (await facilitator.PostAsJsonAsync($"{reviewPath}/finalize",
            new { expectedVersion = readyReview.GetProperty("version").GetUInt32() })).StatusCode);

        var reviewerView = (await Data(await reviewer.GetAsync(reviewPath))).GetProperty("calibration");
        Assert.Equal((4, 3, "Peer outcomes were stronger"), (reviewerView.GetProperty("originalRating").GetInt32(),
            reviewerView.GetProperty("calibratedRating").GetInt32(), reviewerView.GetProperty("rationale").GetString()));
        var adminView = await Data(await facilitator.GetAsync(reviewPath));
        Assert.Equal("Calibration", adminView.GetProperty("finalRatingSource").GetString());
        Assert.Equal(4, adminView.GetProperty("managerAssessment").GetProperty("overallRating").GetInt32());
        var reviewerReview = await Data(await reviewer.GetAsync(reviewPath));
        Assert.Equal(4, reviewerReview.GetProperty("managerAssessment").GetProperty("overallRating").GetInt32());

        var subjectView = await Data(await subject.GetAsync(reviewPath));
        Assert.Equal(3, subjectView.GetProperty("finalRating").GetInt32());
        Assert.Equal(JsonValueKind.Null, subjectView.GetProperty("managerAssessment").GetProperty("overallRating").ValueKind);
        Assert.Equal(JsonValueKind.Null, subjectView.GetProperty("calibration").ValueKind);
        Assert.Equal(JsonValueKind.Null, subjectView.GetProperty("finalRatingSource").ValueKind);
        var raw = await (await subject.GetAsync(reviewPath)).Content.ReadAsStringAsync();
        Assert.DoesNotContain("Peer outcomes were stronger", raw);
        Assert.Equal(HttpStatusCode.Forbidden, (await subject.GetAsync(calibration)).StatusCode);
    }

    [Fact]
    public async Task Calibrators_find_calibration_rounds_from_Reviews()
    {
        using var factory = new PerformanceApiFactory();
        var roundId = await ArrangeAsync(factory);
        var hr = Guid.NewGuid();
        var calibrator = factory.CreateAuthenticatedClient(permissions: Calibrator, userId: hr);
        var context = await Data(await calibrator.GetAsync("/api/performance/context"));
        Assert.True(context.GetProperty("destinations").GetProperty("reviews").GetBoolean());
        var cycleId = context.GetProperty("selected").GetProperty("id").GetString();

        var before = (await Data(await calibrator.GetAsync($"/api/performance/cycles/{cycleId}/calibration")))[0];
        Assert.Equal(JsonValueKind.Null, before.GetProperty("sessionState").ValueKind);
        await calibrator.PostAsync($"/api/performance/review-rounds/{roundId}/calibration", null);
        var after = (await Data(await calibrator.GetAsync($"/api/performance/cycles/{cycleId}/calibration")))[0];
        Assert.True(after.GetProperty("isFacilitator").GetBoolean());
        Assert.Equal(1, after.GetProperty("subjects").GetInt32());

        var other = (await Data(await factory.CreateAuthenticatedClient(permissions: Calibrator, userId: Guid.NewGuid())
            .GetAsync($"/api/performance/cycles/{cycleId}/calibration")))[0];
        Assert.False(other.GetProperty("isFacilitator").GetBoolean());
        Assert.Equal(JsonValueKind.Null, other.GetProperty("subjects").ValueKind);
        Assert.Equal(HttpStatusCode.Forbidden, (await factory.CreateAuthenticatedClient(permissions: RoundAdmin)
            .GetAsync($"/api/performance/cycles/{cycleId}/calibration")).StatusCode);
    }

    [Fact]
    public async Task Only_round_administrators_get_the_rating_distribution_and_its_drill_through_opens()
    {
        using var factory = new PerformanceApiFactory();
        var world = await ArrangeReviewAsync(factory);
        var status = $"/api/performance/review-rounds/{world.RoundId}/status";

        var admin = factory.CreateAuthenticatedClient(permissions: RoundAdmin);
        var data = await Data(await admin.GetAsync(status));
        var strong = data.GetProperty("ratingDistribution").EnumerateArray().Single(level => level.GetProperty("value").GetInt32() == 4);
        Assert.Equal(1, strong.GetProperty("count").GetInt32());
        Assert.Equal(1, data.GetProperty("managerAssessments").GetProperty("submitted").GetInt32());
        var drill = strong.GetProperty("reviews")[0].GetProperty("reviewId").GetString();
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/performance/reviews/{drill}")).StatusCode);

        // Reviewer, subject and a facilitator without round administration get no round-wide distribution.
        var reviewer = factory.CreateAuthenticatedClient(employeeId: world.ReviewerId, permissions: [new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)]);
        var subject = factory.CreateAuthenticatedClient(employeeId: world.SubjectId, permissions: Employee);
        var calibrator = factory.CreateAuthenticatedClient(permissions: Calibrator);
        foreach (var client in new[] { reviewer, subject, calibrator })
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(status)).StatusCode);
        var subjectReview = await (await subject.GetAsync($"/api/performance/reviews/{world.ReviewId}")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("ratingDistribution", subjectReview, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("distribution", subjectReview, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_facilitator_who_is_also_a_subject_calibrates_others_but_never_sees_their_own_review()
    {
        using var factory = new PerformanceApiFactory();
        var world = await ArrangeTwoSubjectsAsync(factory);
        var hr = Guid.NewGuid();
        var calibration = $"/api/performance/review-rounds/{world.RoundId}/calibration";
        var ownId = world.Own.ToString();
        // The facilitator also administers rounds and is one of the round's subjects.
        var selfFacilitator = factory.CreateAuthenticatedClient(employeeId: world.SelfEmployeeId, permissions: [.. Calibrator, .. RoundAdmin], userId: hr);

        var openedResponse = await selfFacilitator.PostAsync(calibration, null);
        var openedRaw = await openedResponse.Content.ReadAsStringAsync();
        var opened = await Data(openedResponse);
        Assert.DoesNotContain(ownId, openedRaw, StringComparison.OrdinalIgnoreCase);
        AssertOnlyOther(opened, world);

        var readRaw = await (await selfFacilitator.GetAsync(calibration)).Content.ReadAsStringAsync();
        Assert.DoesNotContain(ownId, readRaw, StringComparison.OrdinalIgnoreCase);

        // The own review stays a subject's view: no manager content before release, no calibration detail.
        var ownRaw = await (await selfFacilitator.GetAsync($"/api/performance/reviews/{world.Own}")).Content.ReadAsStringAsync();
        var ownReview = JsonDocument.Parse(ownRaw).RootElement.GetProperty("data");
        Assert.Equal(JsonValueKind.Null, ownReview.GetProperty("managerAssessment").ValueKind);
        Assert.Equal(JsonValueKind.Null, ownReview.GetProperty("calibration").ValueKind);
        Assert.DoesNotContain("Own manager note", ownRaw);

        // Adjusting their own review is refused whatever version is sent; others' reviews still adjust.
        Assert.Equal(HttpStatusCode.Forbidden, (await selfFacilitator.PutAsJsonAsync($"{calibration}/subjects/{world.Own}",
            new { rating = 5, rationale = "Self", discussionState = "Discussed", expectedVersion = 0 })).StatusCode);
        var otherVersion = opened.GetProperty("subjects")[0].GetProperty("version").GetUInt32();
        Assert.Equal(HttpStatusCode.OK, (await selfFacilitator.PutAsJsonAsync($"{calibration}/subjects/{world.Other}",
            new { rating = 3, rationale = "Peer outcomes", discussionState = "Discussed", expectedVersion = otherVersion })).StatusCode);

        // Round list counts and the administrator's round distribution leave the own review out too.
        var cycleRounds = (await Data(await selfFacilitator.GetAsync($"/api/performance/cycles/{world.CycleId}/calibration")))[0];
        Assert.Equal(1, cycleRounds.GetProperty("subjects").GetInt32());
        var statusResponse = await selfFacilitator.GetAsync($"/api/performance/review-rounds/{world.RoundId}/status");
        var statusRaw = await statusResponse.Content.ReadAsStringAsync();
        var status = await Data(statusResponse);
        Assert.DoesNotContain(ownId, statusRaw, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, status.GetProperty("ratingDistribution").EnumerateArray().Sum(level => level.GetProperty("count").GetInt32()));

        // Another named facilitator still sees the whole round.
        var session = await Data(await selfFacilitator.GetAsync(calibration));
        var plainId = Guid.NewGuid();
        factory.Holders.Holders.Add(new PermissionHolder(hr, world.SelfEmployeeId, "Hana", "hana@example.test"));
        factory.Holders.Holders.Add(new PermissionHolder(plainId, null, "Plain", "plain@example.test"));
        Assert.Equal(HttpStatusCode.OK, (await selfFacilitator.PutAsJsonAsync($"{calibration}/facilitators",
            new { userIds = new[] { hr, plainId }, expectedVersion = session.GetProperty("version").GetUInt32() })).StatusCode);
        var plainFacilitator = factory.CreateAuthenticatedClient(permissions: Calibrator, userId: plainId);
        Assert.Equal(2, (await Data(await plainFacilitator.GetAsync(calibration))).GetProperty("subjects").GetArrayLength());

        // Finalizing seals every subject, but the response still omits the caller's own review.
        session = await Data(await selfFacilitator.GetAsync(calibration));
        var finalized = await selfFacilitator.PostAsJsonAsync($"{calibration}/finalize", new { expectedVersion = session.GetProperty("version").GetUInt32() });
        Assert.Equal(HttpStatusCode.OK, finalized.StatusCode);
        Assert.DoesNotContain(ownId, await finalized.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        // Releasing results: the administrator learns where others' ratings came from, never their own.
        foreach (var (reviewId, expected) in new[] { (world.Own, (string?)null), (world.Other, "Calibration") })
        {
            var review = await Data(await selfFacilitator.GetAsync($"/api/performance/reviews/{reviewId}"));
            var release = await Data(await selfFacilitator.PostAsJsonAsync($"/api/performance/reviews/{reviewId}/finalize",
                new { expectedVersion = review.GetProperty("version").GetUInt32() }));
            Assert.Equal(expected, release.GetProperty("finalRatingSource").GetString());
        }
    }

    private static void AssertOnlyOther(JsonElement session, TwoSubjects world)
    {
        Assert.Equal(world.Other.ToString(), session.GetProperty("subjects").EnumerateArray().Single().GetProperty("reviewId").GetString());
        Assert.Equal(1, session.GetProperty("counts").GetProperty("subjects").GetInt32());
        var distribution = session.GetProperty("distribution").EnumerateArray().ToArray();
        Assert.Equal(1, distribution.Sum(level => level.GetProperty("original").GetInt32()));
        Assert.Equal(0, distribution.Single(level => level.GetProperty("value").GetInt32() == 2).GetProperty("original").GetInt32());
    }

    [Fact]
    public async Task Another_tenants_calibration_is_not_found()
    {
        using var factory = new PerformanceApiFactory();
        var roundId = await ArrangeAsync(factory);
        var hr = Guid.NewGuid();
        var path = $"/api/performance/review-rounds/{roundId}/calibration";
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateAuthenticatedClient(permissions: Calibrator, userId: hr).PostAsync(path, null)).StatusCode);

        var outsider = factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), permissions: Calibrator, userId: hr);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PostAsync(path, null)).StatusCode);
    }

    private sealed record TwoSubjects(Guid CycleId, Guid RoundId, Guid Other, Guid Own, Guid SelfEmployeeId);

    /// <summary>Two reviews in calibration: another employee rated 4, and the facilitator's own review rated 2.</summary>
    private static async Task<TwoSubjects> ArrangeTwoSubjectsAsync(PerformanceApiFactory factory)
    {
        var tenant = factory.Store.TenantId;
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY26", Start, Start.AddYears(1).AddDays(-1), Start.AddDays(30)).Activated();
        var round = ReviewRound.CreateDraft(tenant, cycle, "Year-end", Start, Start.AddMonths(11), false, false, true);
        var scale = RatingScale.CreateDefault(tenant);
        var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
        var selfEmployee = Guid.NewGuid();
        var other = Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Nour", null, null, null, Guid.NewGuid(), "Lina", false, Start);
        var self = Participant.Create(tenant, cycle.Id, selfEmployee, "Hana", null, null, null, Guid.NewGuid(), "Sami", false, Start);
        var otherSubject = ReviewRoundSubject.Create(tenant, round.Id, other, other.ManagerEmployeeId, "Lina");
        var selfSubject = ReviewRoundSubject.Create(tenant, round.Id, self, self.ManagerEmployeeId, "Sami");
        var otherReview = PerformanceReview.Open(tenant, round, otherSubject, version.Id, version.LevelsJson, DateTime.UtcNow);
        var ownReview = PerformanceReview.Open(tenant, round, selfSubject, version.Id, version.LevelsJson, DateTime.UtcNow);
        round.Launch("{\"competencies\":[]}", version.Id, DateTime.UtcNow);
        otherReview.SubmitManagerAssessment(otherReview.ReviewerEmployeeId, "Strong year", 4, DateTime.UtcNow);
        ownReview.SubmitManagerAssessment(ownReview.ReviewerEmployeeId, "Own manager note", 2, DateTime.UtcNow);
        await using var db = factory.Store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.AddRange(other, self);
        db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(version);
        db.ReviewRounds.Add(round);
        db.ReviewRoundSubjects.AddRange(otherSubject, selfSubject);
        db.PerformanceReviews.AddRange(otherReview, ownReview);
        await db.SaveChangesAsync();
        return new(cycle.Id, round.Id, otherReview.Id, ownReview.Id, selfEmployee);
    }

    private static async Task<JsonElement> Data(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    }

    private static async Task<Guid> ArrangeAsync(PerformanceApiFactory factory) => (await ArrangeReviewAsync(factory)).RoundId;

    private sealed record Arranged(Guid RoundId, Guid ReviewId, Guid SubjectId, Guid ReviewerId);

    private static async Task<Arranged> ArrangeReviewAsync(PerformanceApiFactory factory)
    {
        var tenant = factory.Store.TenantId;
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY26", Start, Start.AddYears(1).AddDays(-1), Start.AddDays(30)).Activated();
        var round = ReviewRound.CreateDraft(tenant, cycle, "Year-end", Start, Start.AddMonths(11), false, false, true);
        var scale = RatingScale.CreateDefault(tenant);
        var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
        var participant = Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Nour", null, null, null, Guid.NewGuid(), "Lina", false, Start);
        var subject = ReviewRoundSubject.Create(tenant, round.Id, participant, participant.ManagerEmployeeId, "Lina");
        var review = PerformanceReview.Open(tenant, round, subject, version.Id, version.LevelsJson, DateTime.UtcNow);
        round.Launch("{\"competencies\":[]}", version.Id, DateTime.UtcNow);
        review.SubmitManagerAssessment(review.ReviewerEmployeeId, "Strong year", 4, DateTime.UtcNow);
        await using var db = factory.Store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.Add(participant);
        db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(version);
        db.ReviewRounds.Add(round);
        db.ReviewRoundSubjects.Add(subject);
        db.PerformanceReviews.Add(review);
        await db.SaveChangesAsync();
        return new(round.Id, review.Id, review.SubjectEmployeeId, review.ReviewerEmployeeId);
    }
}
