using System.Net;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportSemanticTests
{
    private static readonly ImportActor Actor = new(Guid.NewGuid(), "Amina");

    private static readonly string[] Headers =
        ["Matricule", "Full Name", "Work Email", "Responsable", "Poste occupé", "Département", "Weird Column"];

    private static readonly string?[][] Rows =
    [
        ["EMP-000123", "Amina Mansour", "amina@asteria.example", "Youssef Ben Ali", "Ingénieur", "Operations", "alpha"],
        ["EMP-000124", "Youssef Ben Ali", "youssef@asteria.example", "Karim Zayed", "Analyste", "Operations", "beta"],
    ];

    private static readonly string[] PersonPii =
    [
        "Amina", "Mansour", "Youssef", "Ben Ali", "Karim", "Zayed",
        "amina@asteria.example", "youssef@asteria.example", "EMP-000123", "EMP-000124",
    ];

    // A customer file in its own vocabulary: four columns deterministic interpretation cannot place.
    private const string ByofCsv =
        "Personnel No.,First Name,Last Name,Joined,Org Home,Title,Employment State\n"
        + "P-1,Amina,Mansour,2021-02-01,OPS,Lead,Employed Full\n"
        + "P-2,Sami,Ali,2020-01-01,OPS,Dev,Employed Full\n";

    private static IReadOnlyList<WorkforceSemanticColumnContext> BuildColumns()
        => new WorkforceImportSemanticContextBuilder().BuildColumns(
            Headers, Rows.Select(r => (IReadOnlyList<string?>)r).ToList(), Enumerable.Range(0, Headers.Length).ToList());

    private static WorkforceImportSemanticRequest RequestFor(IReadOnlyList<WorkforceSemanticColumnContext> columns)
        => new(WorkforceImportSemanticVersions.ResultContract, "sha",
            columns.Select(c => new ImportSemanticIssue($"column:{c.ColumnIndex}", WorkforceImportSemanticKinds.FieldMapping, c.ColumnIndex, c.SourceLabel,
                [new ImportSemanticTarget("field:Organization", "Organization reference"), new ImportSemanticTarget("field:Ignored", "Not needed")])).ToList(),
            columns, "input");

    // ---- Privacy-minimized context ----

    [Fact]
    public void Context_payload_contains_no_person_pii()
    {
        var json = JsonSerializer.Serialize(BuildColumns());
        foreach (var pii in PersonPii)
            Assert.DoesNotContain(pii, json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Identifier_email_and_person_columns_are_redacted()
    {
        var columns = BuildColumns();
        var matricule = columns.Single(c => c.ColumnIndex == 0);
        Assert.Equal(WorkforceSemanticValueKind.IdentifierLike, matricule.ValueKind);
        Assert.Empty(matricule.SafeVocabularySamples);
        Assert.Contains('#', matricule.PatternSummary);
        Assert.Equal(1m, matricule.UniquenessRate);

        var email = columns.Single(c => c.ColumnIndex == 2);
        Assert.Equal("<email>", email.PatternSummary);
        Assert.Empty(email.SafeVocabularySamples);
        Assert.Empty(columns.Single(c => c.ColumnIndex == 1).SafeVocabularySamples);
        Assert.Empty(columns.Single(c => c.ColumnIndex == 3).SafeVocabularySamples);
    }

    [Fact]
    public void Safe_low_cardinality_business_vocabulary_may_be_sampled()
        => Assert.Contains("Operations", BuildColumns().Single(c => c.ColumnIndex == 5).SafeVocabularySamples);

    [Fact]
    public async Task Unconfigured_provider_fails_as_not_configured()
    {
        var provider = new GroqWorkforceImportSemanticProvider(
            new HttpClient { BaseAddress = new Uri("https://example.test/") },
            new WorkforceImportSemanticAssistanceOptions { Enabled = false });
        Assert.False(provider.IsConfigured);
        var exception = await Assert.ThrowsAsync<ImportSemanticProviderException>(() => provider.SuggestAsync(RequestFor(BuildColumns()), default));
        Assert.Equal(ImportSemanticFailureCategory.NotConfigured, exception.Category);
    }

    [Fact]
    public async Task Serialized_provider_request_contains_no_person_pii_and_uses_strict_schema()
    {
        var handler = new CapturingHandler();
        var provider = new GroqWorkforceImportSemanticProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.groq.com/openai/v1/") },
            new WorkforceImportSemanticAssistanceOptions { Enabled = true, ApiKey = "test-key" });

        var result = await provider.SuggestAsync(RequestFor(BuildColumns()), default);

        Assert.Empty(result.Answers);
        foreach (var pii in PersonPii)
            Assert.DoesNotContain(pii, handler.CapturedBody!, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("test-key", handler.CapturedBody!);
        Assert.Contains("\"strict\":true", handler.CapturedBody!);
    }

    // ---- The shared engine, driven by the Workforce adapter ----

    [Fact]
    public async Task Nothing_to_ask_means_no_provider_call()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(_ => throw new InvalidOperationException("must not be called"));
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, "Employee Number,First Name,Last Name,Employment Start,Organization,Title\nE-1,Amina,Mansour,2021-02-01,OPS,Lead\n",
            provider, ImportSemanticConsentMode.Implicit);
        Assert.Empty(provider.Requests);
        Assert.Equal(0, await db.WorkforceImportSemanticAttempts.CountAsync(a => a.SessionId == session.Id));
    }

    [Fact]
    public async Task Without_workforce_consent_upload_never_calls_the_provider()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(_ => new ImportSemanticProviderResult([], null, null));
        var (db, tenant) = NewDb();
        // Organization consent exists, but it covers a different data contract.
        db.ImportSemanticConsents.Add(ImportSemanticConsent.Grant(tenant, "Groq", "organization-import-semantic-data/1", Actor));
        await db.SaveChangesAsync();

        var session = await Intake(db, tenant, ByofCsv, provider, ImportSemanticConsentMode.Tenant);

        Assert.Empty(provider.Requests);
        var state = await DescribeAsync(db, tenant, session.Id, provider, ImportSemanticConsentMode.Tenant);
        Assert.Equal(ImportSemanticAssistanceState.AwaitingConsent, state.State);
        Assert.Equal(ImportSemanticConsentScope.Tenant, state.ConsentScope);
    }

    [Fact]
    public async Task Granting_workforce_consent_runs_now_and_later_uploads_run_automatically()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(AnswerByofColumns);
        var (db, tenant) = NewDb();
        var first = await Intake(db, tenant, ByofCsv, provider, ImportSemanticConsentMode.Tenant);
        Assert.Empty(provider.Requests);

        var state = await DescribeAsync(db, tenant, first.Id, provider, ImportSemanticConsentMode.Tenant);
        await Semantic(db, tenant, provider, ImportSemanticConsentMode.Tenant)
            .RunAsync(first.Id, new RunWorkforceSemanticAssistanceRequest(state.InputFingerprint!, GrantTenantConsent: true), Actor, default);
        Assert.Single(provider.Requests);
        Assert.Equal(1, await db.ImportSemanticConsents.CountAsync(c => c.DataContractVersion == WorkforceImportSemanticVersions.DataContract));

        // A later upload runs automatically at intake. Its privacy-minimized input is identical (only
        // masked shapes leave Fusion), so the earlier result is reused instead of asking again.
        db.ChangeTracker.Clear();
        var second = await Intake(db, tenant, ByofCsv.Replace("P-2", "P-3"), provider, ImportSemanticConsentMode.Tenant);
        Assert.Single(provider.Requests);
        var reused = await db.WorkforceImportSemanticAttempts.SingleAsync(a => a.SessionId == second.Id);
        Assert.Equal(ImportSemanticTrigger.Upload, reused.Trigger);
        Assert.NotNull(reused.ReusedFromAttemptId);
        Assert.True(second.MatchComplete);
    }

    [Fact]
    public async Task Valid_suggestions_apply_with_semantic_origin_and_abstentions_stay_open()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(AnswerByofColumns);
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, ByofCsv, provider, ImportSemanticConsentMode.Implicit);

        var plan = WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
        Assert.Equal(WorkforceImportField.EmployeeNumber, plan.ColumnMappings[0]);
        Assert.Equal(WorkforceImportField.EmploymentStart, plan.ColumnMappings[3]);
        Assert.Equal(WorkforceImportField.Organization, plan.ColumnMappings[4]);
        Assert.All(new[] { 0, 3, 4 }, index => Assert.Equal(ImportResolutionOrigin.SemanticSuggestion, plan.ColumnOrigins[index]));
        Assert.False(plan.ColumnMappings.ContainsKey(6)); // abstained: still the administrator's to decide
        Assert.True(session.MatchComplete); // the required meanings are now known

        var attempt = await db.WorkforceImportSemanticAttempts.SingleAsync(a => a.SessionId == session.Id);
        Assert.Equal(ImportSemanticAttemptStatus.Succeeded, attempt.Status);
        Assert.Equal(3, attempt.SuggestionsApplied);
        Assert.Equal(1, attempt.Abstentions);
        Assert.Equal(WorkforceImportSemanticVersions.DataContract, attempt.DataContractVersion);
    }

    [Fact]
    public async Task Targets_outside_the_allowed_list_are_rejected()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(request => new ImportSemanticProviderResult(
            request.Questions.Select(q => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest, "field:FusionEmployeeReference")).ToList(), null, null));
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, ByofCsv, provider, ImportSemanticConsentMode.Implicit);

        Assert.Empty(WorkforceImportMappingPlan.Parse(session.MappingPlanJson).ColumnMappings);
        var attempt = await db.WorkforceImportSemanticAttempts.SingleAsync(a => a.SessionId == session.Id);
        Assert.Equal(attempt.SuggestionsReturned, attempt.SuggestionsRejected);
    }

    [Fact]
    public async Task An_identifier_suggestion_that_fails_the_identity_rules_is_not_applied()
    {
        var duplicated = ByofCsv.Replace("P-2", "P-1"); // not unique: cannot identify employees
        var provider = new WorkforceImportTestKit.ScriptedProvider(AnswerByofColumns);
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, duplicated, provider, ImportSemanticConsentMode.Implicit);

        var plan = WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
        Assert.False(plan.ColumnMappings.ContainsKey(0));
        Assert.Equal(WorkforceImportField.Organization, plan.ColumnMappings[4]); // ordinary meanings still apply
    }

    [Fact]
    public async Task Provider_failure_leaves_the_upload_and_manual_match_intact()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(_ =>
            throw new ImportSemanticProviderException(ImportSemanticFailureCategory.ProviderUnavailable, "down"));
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, ByofCsv, provider, ImportSemanticConsentMode.Implicit);

        Assert.Equal(WorkforceImportStatus.Active, session.Status);
        Assert.False(session.MatchComplete);
        var attempt = await db.WorkforceImportSemanticAttempts.SingleAsync(a => a.SessionId == session.Id);
        Assert.Equal(ImportSemanticAttemptStatus.Failed, attempt.Status);
        Assert.Equal(ImportSemanticFailureCategory.ProviderUnavailable, attempt.FailureCategory);
    }

    [Fact]
    public async Task An_administrator_change_to_a_suggestion_is_recorded_as_an_override()
    {
        var provider = new WorkforceImportTestKit.ScriptedProvider(AnswerByofColumns);
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, ByofCsv, provider, ImportSemanticConsentMode.Implicit);

        var review = WorkforceImportTestKit.Review(db, tenant);
        var updated = await review.UpdateMatchAsync(session.Id, session.Version,
            new WorkforceMatchUpdateRequest(ColumnMappings: new() { [4] = WorkforceImportField.Location }), Actor, default);

        var plan = WorkforceImportMappingPlan.Parse(updated.MappingPlanJson);
        Assert.Equal(ImportResolutionOrigin.Administrator, plan.ColumnOrigins[4]);
        Assert.Equal(1, (await db.WorkforceImportSemanticAttempts.SingleAsync(a => a.SessionId == session.Id)).SuggestionsOverridden);
    }

    [Fact]
    public async Task Unknown_status_values_are_vocabulary_questions_answered_only_as_active_or_former()
    {
        const string csv = "Employee Number,First Name,Last Name,Employment Start,Organization,Title,Status\n"
            + "E-1,Amina,Mansour,2021-02-01,OPS,Lead,On Payroll\nE-2,Sami,Ali,2021-02-01,OPS,Dev,Gone\n";
        var provider = new WorkforceImportTestKit.ScriptedProvider(request => new ImportSemanticProviderResult(
            request.Questions.Select(q => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest,
                q.SourceLabel == "Gone" ? "lifecycle:Former" : "lifecycle:Active")).ToList(), null, null));
        var (db, tenant) = NewDb();
        var session = await Intake(db, tenant, csv, provider, ImportSemanticConsentMode.Implicit);

        var questions = Assert.Single(provider.Requests).Questions;
        Assert.All(questions, q => Assert.Equal(WorkforceImportSemanticKinds.LifecycleVocabulary, q.Kind));
        Assert.All(questions, q => Assert.Equal(["lifecycle:Active", "lifecycle:Former"], q.AllowedTargets.Select(t => t.Key)));
        var plan = WorkforceImportMappingPlan.Parse(session.MappingPlanJson);
        Assert.Equal(WorkforceLifecycle.Former, plan.LifecycleVocabulary["gone"]);
        Assert.Equal(1, session.NotImportedCount); // derived from lifecycle, never a mapping target
    }

    // ---- helpers ----

    private static ImportSemanticProviderResult AnswerByofColumns(WorkforceImportSemanticRequest request)
        => new(request.Questions.Select(q => q.Key switch
        {
            "column:0" => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest, "field:EmployeeNumber"),
            "column:3" => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest, "field:EmploymentStart"),
            "column:4" => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Suggest, "field:Organization"),
            _ => new ImportSemanticAnswer(q.Key, ImportSemanticDisposition.Abstain, null),
        }).ToList(), 100, 20);

    private static (CoreHRDbContext Db, Guid Tenant) NewDb()
    {
        var tenant = Guid.NewGuid();
        return (TestDbContextFactory.Create(TestTenantContext.WithTenant(tenant), Guid.NewGuid().ToString()), tenant);
    }

    private static WorkforceImportSemanticAssistanceService Semantic(CoreHRDbContext db, Guid tenant, IWorkforceImportSemanticProvider provider, ImportSemanticConsentMode mode)
        => WorkforceImportTestKit.Semantic(db, tenant, provider, new WorkforceImportSemanticAssistanceOptions { ConsentMode = mode, MaxRetries = 0 });

    private static async Task<WorkforceImportSession> Intake(
        CoreHRDbContext db, Guid tenant, string csv, IWorkforceImportSemanticProvider provider, ImportSemanticConsentMode mode)
    {
        var sessions = new WorkforceImportSessionService(db, TestTenantContext.WithTenant(tenant), new SafeTabularSourceReader(),
            new WorkforceImportSourceAdapter(), WorkforceImportTestKit.Derivation(db, tenant), Semantic(db, tenant, provider, mode));
        var outcome = await sessions.IntakeAsync(new WorkforceImportIntakeRequest(
            Guid.NewGuid(), new DateOnly(2026, 8, 17), new MemoryStream(Encoding.UTF8.GetBytes(csv)), "wf.csv", "text/csv", null, Actor), default);
        db.ChangeTracker.Clear();
        return await db.WorkforceImportSessions.Include(s => s.Source).AsNoTracking().SingleAsync(s => s.Id == outcome.Session!.Id);
    }

    private static async Task<ImportSemanticAssistanceDto> DescribeAsync(
        CoreHRDbContext db, Guid tenant, Guid sessionId, IWorkforceImportSemanticProvider provider, ImportSemanticConsentMode mode)
    {
        var session = await db.WorkforceImportSessions.Include(s => s.Source).AsNoTracking().SingleAsync(s => s.Id == sessionId);
        var rows = await db.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId).ToListAsync();
        var match = await WorkforceImportTestKit.Derivation(db, tenant).InterpretAsync(session, rows, default);
        return await Semantic(db, tenant, provider, mode).DescribeAsync(session, match, default);
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? CapturedBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CapturedBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            var content = "{\"contractVersion\":\"" + WorkforceImportSemanticVersions.ResultContract + "\",\"answers\":[]}";
            var envelope = "{\"choices\":[{\"message\":{\"content\":" + JsonSerializer.Serialize(content) + "}}]}";
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(envelope, Encoding.UTF8, "application/json") };
        }
    }
}
