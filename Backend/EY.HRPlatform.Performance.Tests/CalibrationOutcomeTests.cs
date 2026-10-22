using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;
using static EY.HRPlatform.Performance.Tests.TestHelpers.CalibrationWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// What reviewers and subjects see around calibration (D-23, D-R5): the reviewer's outcome and reason at finalization,
/// the summary they may revise until release (call 7), the work item, and the facilitator's lead on Reviews.
/// </summary>
public sealed class CalibrationOutcomeTests
{
    private static readonly Guid KhaledEmployee = Guid.NewGuid();
    private static readonly FacilitatorIdentity Khaled = new(Guid.NewGuid(), KhaledEmployee, "Khaled Sassi");
    private static readonly EffectivePermissionGrant[] Calibrator =
        [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.ReviewCalibrate, PermissionScopes.Tenant)];
    private static readonly EffectivePermissionGrant[] Reviewer = [new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)];
    private static readonly EffectivePermissionGrant[] Employee =
        [new(PerformancePermissions.CycleView, PermissionScopes.Self), new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)];
    private static readonly EffectivePermissionGrant[] Admin =
        [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)];

    private sealed record Arranged(PerformanceApiFactory Factory, World World, PerformanceReview Tarek, PerformanceReview Fares);

    /// <summary>Mariam reviews Tarek (4 → 3 in calibration) and Fares (unchanged, potential raised). Khaled facilitates and is himself a subject.</summary>
    private static async Task<Arranged> ArrangeAsync(bool finalize)
    {
        var factory = new PerformanceApiFactory();
        await using var db = factory.Store.NewContext();
        var world = await SeedAsync(db, factory.Store,
            [new("Tarek Ayari", "Mariam Gharbi"), new("Fares Lachheb", "Mariam Gharbi"), new("Khaled Sassi", "Youssef Trabelsi", KhaledEmployee)]);
        await SubmitManagerAsync(db, world.Of("Tarek Ayari"), 4, ReviewPotential.Growing, "Went beyond the role this year.");
        await SubmitManagerAsync(db, world.Of("Fares Lachheb"), 3, ReviewPotential.Growing);
        await SubmitManagerAsync(db, world.Of("Khaled Sassi"), 4, ReviewPotential.High);
        var opened = await OpenAsync(db, world);
        var session = await db.CalibrationSessions.FindAsync(opened.Value.Id);
        session!.ReplaceFacilitators([Hr, Khaled], Hr.UserId, DateTime.UtcNow);
        await db.SaveChangesAsync();
        Assert.True((await AdjustAsync(db, world, world.Of("Tarek Ayari"), 3, "Went beyond the role once; the rest met it.", actor: Khaled)).IsSuccess);
        Assert.True((await AdjustAsync(db, world, world.Of("Fares Lachheb"), 3, "Ready for a lead role.", ReviewPotential.High)).IsSuccess);
        if (finalize) Assert.True((await FinalizeAsync(db, world)).IsSuccess);
        return new(factory, world, world.Of("Tarek Ayari"), world.Of("Fares Lachheb"));
    }

    private static Task<JsonElement> Data(HttpResponseMessage response) => ReviewQuestionLibraryTests.ReadDataAsync(response);

    [Fact]
    public async Task During_the_session_the_reviewer_sees_their_reviews_in_calibration_with_their_own_ratings()
    {
        var (factory, world, tarek, _) = await ArrangeAsync(finalize: false);
        await using var scope = factory;
        using var mariam = factory.CreateAuthenticatedClient(employeeId: tarek.ReviewerEmployeeId, permissions: Reviewer);
        var review = await Data(await mariam.GetAsync($"/api/performance/reviews/{tarek.Id}"));
        Assert.Equal(JsonValueKind.Null, review.GetProperty("calibration").ValueKind);
        Assert.Equal("Growing", review.GetProperty("potential").GetString());

        var workspace = await Data(await mariam.GetAsync($"/api/performance/reviews/workspace?cycle={world.Cycle.Id}"));
        var row = workspace.GetProperty("toWrite").EnumerateArray().Single(item => item.GetProperty("subjectDisplayName").GetString() == "Tarek Ayari");
        Assert.Equal(("Calibration", 4), (row.GetProperty("state").GetString(), row.GetProperty("managerRating").GetInt32()));
        Assert.Equal(JsonValueKind.Null, row.GetProperty("finalRating").ValueKind);
        Assert.False(row.GetProperty("calibrationChanged").GetBoolean());
    }

    [Fact]
    public async Task At_finalization_the_reviewer_sees_the_outcome_reason_and_potential_and_the_subject_sees_nothing()
    {
        var (factory, world, tarek, fares) = await ArrangeAsync(finalize: true);
        await using var scope = factory;
        using var mariam = factory.CreateAuthenticatedClient(employeeId: tarek.ReviewerEmployeeId, permissions: Reviewer);
        var review = await Data(await mariam.GetAsync($"/api/performance/reviews/{tarek.Id}"));
        var calibration = review.GetProperty("calibration");
        Assert.Equal((4, 3), (calibration.GetProperty("originalRating").GetInt32(), calibration.GetProperty("calibratedRating").GetInt32()));
        Assert.Equal("Went beyond the role once; the rest met it.", calibration.GetProperty("rationale").GetString());
        Assert.Equal("Khaled Sassi", calibration.GetProperty("changedBy").GetString());
        Assert.True(calibration.GetProperty("canReviseSummary").GetBoolean());

        var faresReview = await Data(await mariam.GetAsync($"/api/performance/reviews/{fares.Id}"));
        Assert.Equal(("Growing", "High"), (faresReview.GetProperty("calibration").GetProperty("originalPotential").GetString(),
            faresReview.GetProperty("calibration").GetProperty("calibratedPotential").GetString()));
        Assert.Equal("High", faresReview.GetProperty("potential").GetString());
        Assert.False(faresReview.GetProperty("calibration").GetProperty("canReviseSummary").GetBoolean());

        var workspace = await Data(await mariam.GetAsync($"/api/performance/reviews/workspace?cycle={world.Cycle.Id}"));
        var row = workspace.GetProperty("toWrite").EnumerateArray().Single(item => item.GetProperty("subjectDisplayName").GetString() == "Tarek Ayari");
        Assert.Equal((4, 3, true, true), (row.GetProperty("managerRating").GetInt32(), row.GetProperty("finalRating").GetInt32(),
            row.GetProperty("calibrationChanged").GetBoolean(), row.GetProperty("summaryToCheck").GetBoolean()));

        using var subject = factory.CreateAuthenticatedClient(employeeId: tarek.SubjectEmployeeId, permissions: Employee);
        var own = await Data(await subject.GetAsync($"/api/performance/reviews/{tarek.Id}"));
        Assert.Equal(JsonValueKind.Null, own.GetProperty("calibration").ValueKind);
        Assert.Equal(JsonValueKind.Null, own.GetProperty("potential").ValueKind);
        Assert.Equal(JsonValueKind.Null, own.GetProperty("finalRating").ValueKind);
    }

    [Fact]
    public async Task Only_the_summary_reopens_and_only_until_release()
    {
        var (factory, world, tarek, fares) = await ArrangeAsync(finalize: true);
        await using var scope = factory;
        using var mariam = factory.CreateAuthenticatedClient(employeeId: tarek.ReviewerEmployeeId, permissions: Reviewer);
        var work = await Data(await mariam.GetAsync("/api/performance/work"));
        Assert.Contains(work.EnumerateArray(), item => item.GetProperty("kind").GetString() == "check-review-summary"
            && item.GetProperty("title").GetString() == "Check your summary for Tarek Ayari"
            && item.GetProperty("section").GetString() == "/performance/reviews");

        // Unchanged rating: nothing reopens.
        var faresVersion = await VersionAsync(factory, fares.Id);
        using (var unchanged = await mariam.PutAsJsonAsync($"/api/performance/reviews/{fares.Id}/manager-summary", new { summary = "New words.", expectedVersion = faresVersion }))
            Assert.Equal(HttpStatusCode.Conflict, unchanged.StatusCode);
        // Someone else's review.
        using (var other = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Reviewer))
        using (var denied = await other.PostAsync($"/api/performance/reviews/{tarek.Id}/summary-checked", null))
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        // The rest of the assessment stays locked.
        using (var locked = await mariam.PutAsJsonAsync($"/api/performance/reviews/{tarek.Id}/manager-assessment",
            new { summary = "x", overallRating = 4, expectedVersion = await VersionAsync(factory, tarek.Id) }))
            Assert.False(locked.IsSuccessStatusCode);

        var revised = await Data(await mariam.PutAsJsonAsync($"/api/performance/reviews/{tarek.Id}/manager-summary",
            new { summary = "Met the role across the year, and went beyond it on the client migration.", expectedVersion = await VersionAsync(factory, tarek.Id) }));
        Assert.NotEqual(JsonValueKind.Null, revised.GetProperty("summaryRevisedAt").ValueKind);
        Assert.DoesNotContain((await Data(await mariam.GetAsync("/api/performance/work"))).EnumerateArray(),
            item => item.GetProperty("kind").GetString() == "check-review-summary");
        await using (var db = factory.Store.NewContext())
        {
            var entry = await db.AuditEntries.SingleAsync(item => item.Action == PerformanceAuditActions.ReviewSummaryRevised);
            Assert.DoesNotContain("client migration", entry.Summary);
        }
        var check = await Data(await mariam.PostAsync($"/api/performance/reviews/{tarek.Id}/summary-checked", null));
        var again = await Data(await mariam.PostAsync($"/api/performance/reviews/{tarek.Id}/summary-checked", null));
        Assert.Equal(check.GetProperty("summaryCheckedAt").GetDateTime(), again.GetProperty("summaryCheckedAt").GetDateTime());

        // Release: the result carries the revised summary, and nothing reopens after.
        using var admin = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Admin);
        Assert.True((await admin.PostAsJsonAsync($"/api/performance/reviews/{tarek.Id}/finalize",
            new { expectedVersion = await VersionAsync(factory, tarek.Id) })).IsSuccessStatusCode);
        using var subject = factory.CreateAuthenticatedClient(employeeId: tarek.SubjectEmployeeId, permissions: Employee);
        var released = await Data(await subject.GetAsync($"/api/performance/reviews/{tarek.Id}"));
        Assert.Equal("Met the role across the year, and went beyond it on the client migration.",
            released.GetProperty("managerAssessment").GetProperty("summary").GetString());
        Assert.Equal(3, released.GetProperty("finalRating").GetInt32());
        using (var late = await mariam.PutAsJsonAsync($"/api/performance/reviews/{tarek.Id}/manager-summary",
            new { summary = "Too late.", expectedVersion = await VersionAsync(factory, tarek.Id) }))
            Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
    }

    [Fact]
    public async Task A_facilitator_finds_the_session_first_on_Reviews_without_their_own_review()
    {
        var (factory, world, _, _) = await ArrangeAsync(finalize: false);
        await using var scope = factory;
        using var khaled = factory.CreateAuthenticatedClient(employeeId: KhaledEmployee, permissions: [.. Calibrator, .. Reviewer], userId: Khaled.UserId);
        var workspace = await Data(await khaled.GetAsync($"/api/performance/reviews/workspace?cycle={world.Cycle.Id}"));
        var session = Assert.Single(workspace.GetProperty("sessions").EnumerateArray().ToArray());
        Assert.Equal((world.Round.Id, 2, 0), (session.GetProperty("roundId").GetGuid(), session.GetProperty("people").GetInt32(),
            session.GetProperty("outstanding").GetInt32()));

        using var mariam = factory.CreateAuthenticatedClient(employeeId: world.Of("Tarek Ayari").ReviewerEmployeeId, permissions: Reviewer);
        Assert.Empty((await Data(await mariam.GetAsync($"/api/performance/reviews/workspace?cycle={world.Cycle.Id}"))).GetProperty("sessions").EnumerateArray());
    }

    private static async Task<uint> VersionAsync(PerformanceApiFactory factory, Guid reviewId)
    {
        await using var db = factory.Store.NewContext();
        return await db.PerformanceReviews.AsNoTracking().Where(item => item.Id == reviewId).Select(item => item.Version).SingleAsync();
    }
}
