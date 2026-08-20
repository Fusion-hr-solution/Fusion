using System.Net;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportSemanticTests
{
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

    private static WorkforceImportSemanticRequest BuildRequest()
        => new WorkforceImportSemanticContextBuilder().Build(
            Headers,
            Rows.Select(r => (IReadOnlyList<string?>)r).ToList(),
            Enumerable.Range(0, Headers.Length).ToList(),
            WorkforceSemanticTargets.All);

    [Fact]
    public void Context_payload_contains_no_person_pii()
    {
        var json = JsonSerializer.Serialize(BuildRequest());
        foreach (var pii in PersonPii)
            Assert.DoesNotContain(pii, json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Identifier_and_email_and_name_columns_are_redacted()
    {
        var request = BuildRequest();
        var matricule = request.Columns.Single(c => c.ColumnIndex == 0);
        Assert.Equal(WorkforceSemanticValueKind.IdentifierLike, matricule.ValueKind);
        Assert.Empty(matricule.SafeVocabularySamples);
        Assert.Contains('#', matricule.PatternSummary);

        var email = request.Columns.Single(c => c.ColumnIndex == 2);
        Assert.Equal(WorkforceSemanticValueKind.EmailLike, email.ValueKind);
        Assert.Equal("<email>", email.PatternSummary);
        Assert.Empty(email.SafeVocabularySamples);

        var fullName = request.Columns.Single(c => c.ColumnIndex == 1);
        Assert.Empty(fullName.SafeVocabularySamples); // person label → no raw samples

        var manager = request.Columns.Single(c => c.ColumnIndex == 3);
        Assert.Empty(manager.SafeVocabularySamples);
    }

    [Fact]
    public void Safe_low_cardinality_business_vocabulary_may_be_sampled()
    {
        var request = BuildRequest();
        var department = request.Columns.Single(c => c.ColumnIndex == 5);
        Assert.Equal(WorkforceSemanticValueKind.Text, department.ValueKind);
        Assert.Contains("Operations", department.SafeVocabularySamples);
    }

    [Fact]
    public async Task Unconfigured_provider_throws_not_configured_and_preserves_manual_path()
    {
        var provider = new GroqWorkforceImportSemanticProvider(
            new HttpClient { BaseAddress = new Uri("https://example.test/") },
            new WorkforceImportSemanticAssistanceOptions { Enabled = false });
        Assert.False(provider.IsConfigured);
        var exception = await Assert.ThrowsAsync<WorkforceImportSemanticProviderException>(
            () => provider.SuggestAsync(BuildRequest(), default));
        Assert.Equal(WorkforceSemanticFailureCategory.NotConfigured, exception.Category);
    }

    [Fact]
    public async Task Suggest_service_returns_manual_path_when_provider_unavailable()
    {
        var tenantId = Guid.NewGuid();
        var tenantContext = EY.HRPlatform.CoreHR.Tests.TestHelpers.TestTenantContext.WithTenant(tenantId);
        await using var db = EY.HRPlatform.CoreHR.Tests.TestHelpers.TestDbContextFactory.Create(tenantContext);

        // Seed a session with an unresolved column via intake.
        const string csv = "Matricule,Weird Vocab\n001,alpha\n";
        var session = new WorkforceImportSessionService(db, tenantContext, new SafeTabularSourceReader(), new WorkforceImportSourceAdapter());
        var outcome = await session.IntakeAsync(new WorkforceImportIntakeRequest(
            Guid.NewGuid(), new DateOnly(2026, 8, 17), new MemoryStream(Encoding.UTF8.GetBytes(csv)), "f.csv", "text/csv", null,
            new WorkforceImportActor(Guid.NewGuid(), "Amina")), default);

        var service = new WorkforceImportSemanticService(db, tenantContext, new WorkforceImportInterpreter(),
            new WorkforceImportSemanticContextBuilder(),
            new GroqWorkforceImportSemanticProvider(new HttpClient { BaseAddress = new Uri("https://x.test/") },
                new WorkforceImportSemanticAssistanceOptions { Enabled = false }));

        var result = await service.SuggestAsync(outcome.Session!.Id, default);
        Assert.False(result.Available); // manual path intact
        Assert.Empty(result.Suggestions);
        Assert.NotNull(result.Reason);
    }

    [Fact]
    public async Task Serialized_provider_input_contains_no_person_pii()
    {
        var handler = new CapturingHandler();
        var provider = new GroqWorkforceImportSemanticProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.groq.com/openai/v1/") },
            new WorkforceImportSemanticAssistanceOptions { Enabled = true, ApiKey = "test-key" });

        var result = await provider.SuggestAsync(BuildRequest(), default);

        Assert.Empty(result.Suggestions);
        Assert.NotNull(handler.CapturedBody);
        foreach (var pii in PersonPii)
            Assert.DoesNotContain(pii, handler.CapturedBody!, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("test-key", handler.CapturedBody!); // api key rides in the header, not the body
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? CapturedBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CapturedBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            const string content = "{\"contractVersion\":\"workforce-import-semantic-v1\",\"suggestions\":[]}";
            var envelope = "{\"choices\":[{\"message\":{\"content\":" + JsonSerializer.Serialize(content) + "}}]}";
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(envelope, Encoding.UTF8, "application/json") };
        }
    }
}
