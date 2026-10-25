using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Settings › Reviews: the question library (D-19) and the due-date defaults (D-02).</summary>
public sealed class ReviewQuestionLibraryTests
{
    private static readonly EffectivePermissionGrant[] Admin =
        [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant),
         new(PerformancePermissions.SettingsManage, PermissionScopes.Tenant)];

    [Fact]
    public void Question_text_is_bounded_and_archived_questions_are_read_only()
    {
        var tenant = Guid.NewGuid();
        Assert.Throws<ArgumentException>(() => ReviewQuestion.Create(tenant, "Why", ReviewQuestionAudience.Person, 0));
        Assert.Throws<ArgumentException>(() => ReviewQuestion.Create(tenant, new string('a', 301), ReviewQuestionAudience.Person, 0));
        var question = ReviewQuestion.Create(tenant, "  What did you learn from a setback?  ", ReviewQuestionAudience.Person, 3);
        Assert.Equal("What did you learn from a setback?", question.Text);
        question.Archive();
        Assert.Throws<InvalidOperationException>(() => question.Update("What would you do differently?"));
        Assert.Throws<InvalidOperationException>(() => question.MarkUsed(DateTime.UtcNow));
    }

    [Fact]
    public void Defaults_are_three_questions_per_audience_in_order()
    {
        var defaults = ReviewQuestionDefaults.Create(Guid.NewGuid());
        Assert.Equal(9, defaults.Count);
        foreach (var audience in Enum.GetValues<ReviewQuestionAudience>())
            Assert.Equal([0, 1, 2], defaults.Where(q => q.Audience == audience).Select(q => q.SortOrder));
    }

    [Fact]
    public async Task Library_is_seeded_on_first_read_admin_only_tenant_scoped_and_used_questions_are_archived_not_deleted()
    {
        await using var factory = new PerformanceApiFactory();
        using var viewer = factory.CreateAuthenticatedClient(permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using (var denied = await viewer.GetAsync("/api/performance/settings/review-questions"))
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        using (var deniedAdd = await viewer.PostAsJsonAsync("/api/performance/settings/review-questions",
            new { text = "What did you learn from a setback?", audience = "Person" }))
            Assert.Equal(HttpStatusCode.Forbidden, deniedAdd.StatusCode);

        using var admin = factory.CreateAuthenticatedClient(permissions: Admin);
        var library = await ReadDataAsync(await admin.GetAsync("/api/performance/settings/review-questions"));
        Assert.Equal(9, library.GetArrayLength());
        Assert.Equal(3, library.EnumerateArray().Count(q => q.GetProperty("audience").GetString() == "Peer"));
        // A second read doesn't seed again.
        Assert.Equal(9, (await ReadDataAsync(await admin.GetAsync("/api/performance/settings/review-questions"))).GetArrayLength());

        using (var tooShort = await admin.PostAsJsonAsync("/api/performance/settings/review-questions", new { text = "Why", audience = "Person" }))
            Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
        var added = await ReadDataAsync(await admin.PostAsJsonAsync("/api/performance/settings/review-questions",
            new { text = "What did you learn from a setback?", audience = "Person" }));
        Assert.Equal(3, added.GetProperty("sortOrder").GetInt32());
        var addedId = added.GetProperty("id").GetGuid();

        var edited = await ReadDataAsync(await admin.PutAsJsonAsync($"/api/performance/settings/review-questions/{addedId}",
            new { expectedVersion = added.GetProperty("version").GetUInt32(), text = "What did a setback teach you?" }));
        Assert.Equal("What did a setback teach you?", edited.GetProperty("text").GetString());

        var person = (await ReadDataAsync(await admin.GetAsync("/api/performance/settings/review-questions"))).EnumerateArray()
            .Where(q => q.GetProperty("audience").GetString() == "Person").Select(q => q.GetProperty("id").GetGuid()).Reverse().ToArray();
        var reordered = await ReadDataAsync(await admin.PutAsJsonAsync("/api/performance/settings/review-questions/order",
            new { audience = "Person", questionIds = person }));
        Assert.Equal(addedId, reordered.EnumerateArray().First(q => q.GetProperty("audience").GetString() == "Person").GetProperty("id").GetGuid());
        using (var partial = await admin.PutAsJsonAsync("/api/performance/settings/review-questions/order",
            new { audience = "Person", questionIds = person.Take(2).ToArray() }))
            Assert.Equal(HttpStatusCode.BadRequest, partial.StatusCode);

        // A launched round used one of the defaults: deleting it is refused, archiving still works.
        var used = library.EnumerateArray().First();
        var usedId = used.GetProperty("id").GetGuid();
        await using (var db = factory.Store.NewContext())
        {
            var question = db.ReviewQuestions.Single(q => q.Id == usedId);
            question.MarkUsed(DateTime.UtcNow);
            await db.SaveChangesAsync();
        }
        var current = (await ReadDataAsync(await admin.GetAsync("/api/performance/settings/review-questions")))
            .EnumerateArray().Single(q => q.GetProperty("id").GetGuid() == usedId);
        using (var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/performance/settings/review-questions/{usedId}")
        { Content = JsonContent.Create(new { expectedVersion = current.GetProperty("version").GetUInt32() }) })
        using (var refused = await admin.SendAsync(delete))
        {
            Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
            Assert.Contains("ReviewQuestion.InUse", await refused.Content.ReadAsStringAsync());
        }
        var archived = await ReadDataAsync(await admin.PostAsJsonAsync($"/api/performance/settings/review-questions/{usedId}/archive",
            new { expectedVersion = current.GetProperty("version").GetUInt32() }));
        Assert.Equal("Archived", archived.GetProperty("state").GetString());

        // An unused question deletes.
        using (var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/performance/settings/review-questions/{addedId}")
        { Content = JsonContent.Create(new { expectedVersion = edited.GetProperty("version").GetUInt32() }) })
        using (var deleted = await admin.SendAsync(delete))
            Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);

        using var otherTenant = factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), permissions: Admin);
        var theirs = await ReadDataAsync(await otherTenant.GetAsync("/api/performance/settings/review-questions"));
        Assert.Equal(9, theirs.GetArrayLength());
        Assert.DoesNotContain(theirs.EnumerateArray(), q => q.GetProperty("id").GetGuid() == usedId);
        using (var foreign = await otherTenant.PostAsJsonAsync($"/api/performance/settings/review-questions/{usedId}/archive", new { expectedVersion = 0u }))
            Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }

    [Fact]
    public async Task Due_date_defaults_start_at_D02_values_are_bounded_and_leave_existing_rounds_alone()
    {
        await using var factory = new PerformanceApiFactory();
        var start = new DateOnly(2026, 1, 1);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "FY26", start, new DateOnly(2026, 12, 31), start.AddDays(30)).Activated();
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(cycle);
            await db.SaveChangesAsync();
        }
        using var admin = factory.CreateAuthenticatedClient(permissions: Admin);
        var settings = await ReadDataAsync(await admin.GetAsync("/api/performance/settings"));
        Assert.Equal((14, 14, 7, 7), (settings.GetProperty("selfAssessmentDueDays").GetInt32(), settings.GetProperty("peerInputDueDays").GetInt32(),
            settings.GetProperty("managerAssessmentDueDays").GetInt32(), settings.GetProperty("acknowledgementReminderDays").GetInt32()));

        var round = await ReadDataAsync(await admin.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/review-rounds",
            new { name = "Year-end", periodStart = start, periodEnd = new DateOnly(2026, 8, 31) }));
        var roundId = round.GetProperty("id").GetGuid();

        using (var outOfRange = await admin.PutAsJsonAsync("/api/performance/settings", SettingsBody(settings, selfDays: 90)))
            Assert.Equal(HttpStatusCode.BadRequest, outOfRange.StatusCode);
        using (var reminderTooLong = await admin.PutAsJsonAsync("/api/performance/settings", SettingsBody(settings, ackDays: 31)))
            Assert.Equal(HttpStatusCode.BadRequest, reminderTooLong.StatusCode);
        var changed = await ReadDataAsync(await admin.PutAsJsonAsync("/api/performance/settings", SettingsBody(settings, managerDays: 10)));
        Assert.Equal(10, changed.GetProperty("managerAssessmentDueDays").GetInt32());

        await using (var db = factory.Store.NewContext())
        {
            var existing = db.ReviewRounds.Single(r => r.Id == roundId);
            Assert.Equal(7, existing.ManagerAssessmentDueDays);
            var launchDay = new DateOnly(2026, 9, 1);
            Assert.Equal(new ReviewRoundSchedule(new(2026, 9, 15), new(2026, 9, 15), new(2026, 9, 22)), existing.ScheduleFor(launchDay));
        }
        var next = await ReadDataAsync(await admin.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/review-rounds",
            new { name = "Spot review", periodStart = start, periodEnd = new DateOnly(2026, 8, 31) }));
        await using (var db = factory.Store.NewContext())
            Assert.Equal(10, db.ReviewRounds.Single(r => r.Id == next.GetProperty("id").GetGuid()).ManagerAssessmentDueDays);
    }

    private static object SettingsBody(JsonElement current, int? selfDays = null, int? managerDays = null, int? ackDays = null) => new
    {
        defaultMeasurementMethod = current.GetProperty("defaultMeasurementMethod").GetString(),
        suggestedObjectiveCountMin = current.GetProperty("suggestedObjectiveCountMin").GetInt32(),
        suggestedObjectiveCountMax = current.GetProperty("suggestedObjectiveCountMax").GetInt32(),
        planningDeadlineOffsetDays = current.GetProperty("planningDeadlineOffsetDays").GetInt32(),
        planAlignmentPolicy = current.GetProperty("planAlignmentPolicy").GetString(),
        selfAssessmentDueDays = selfDays,
        managerAssessmentDueDays = managerDays,
        acknowledgementReminderDays = ackDays,
        expectedVersion = current.GetProperty("version").GetUInt32(),
    };

    internal static async Task<JsonElement> ReadDataAsync(HttpResponseMessage response)
    {
        using (response)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {body}");
            using var json = JsonDocument.Parse(body);
            return json.RootElement.GetProperty("data").Clone();
        }
    }
}
