using System.Diagnostics;
using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportSemanticAssistanceTests
{
    private static readonly DateOnly EffectiveDate = new(2026, 8, 14);

    // ── Context ────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Context_IsBoundedRedactedStableAndNeverOffersFusionIdentity()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var session = Session(tenant.TenantId, new OrganizationSourceTable(
            [
                new(0, "Display Label"),
                new(1, "External Ref"),
                new(2, "Kind"),
                new(3, "Reports To"),
                new(4, "Fusion OrgUnit ID"),
                new(5, "Employee Email"),
                new(6, "Comments"),
                new(7, "Country Footprint"),
            ],
            [
                new string?[] { "Asteria", null, "Organization", null, Guid.NewGuid().ToString(), "ada@example.com", "private note", "FR" },
                new string?[] { "Sales", "SALES", "Team", "Asteria", Guid.NewGuid().ToString(), "sam@example.com", "private note", "FR, DE" },
            ]));
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var options = Options().WithBounds(maxFields: 7, maxValues: 1, maxTotalValues: 3, maxValueCharacters: 16);
        var builder = new OrganizationImportSemanticContextBuilder(options);

        var first = Assert.IsType<OrganizationImportSemanticRequest>(builder.Build(session, review).Request);
        session.ChangeEffectiveDate(EffectiveDate.AddDays(30), Actor());
        var afterDateChange = Assert.IsType<OrganizationImportSemanticRequest>(builder.Build(session, review).Request);

        Assert.Equal(first.InputFingerprint, afterDateChange.InputFingerprint);
        Assert.Equal(OrganizationImportSemanticVersions.ResultContract, first.ResultContractVersion);
        Assert.True(first.Fields.Count <= 7);
        Assert.All(first.Fields, field => Assert.True(field.SourceLabel.Length <= 16));
        Assert.DoesNotContain(first.Fields, field => field.SourceLabel.Contains("Fusion", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(first.Fields, field => field.SourceLabel.Contains("Email", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(first.Fields, field => field.SourceLabel.Contains("Comment", StringComparison.OrdinalIgnoreCase));
        Assert.All(first.Issues.Where(issue => issue.Kind == OrganizationImportSemanticKinds.FieldMapping), issue =>
            Assert.DoesNotContain(issue.AllowedTargets, target => target.Key.Contains(OrganizationImportFields.FusionOrgUnitId, StringComparison.Ordinal)));
        Assert.All(first.Fields.SelectMany(field => field.RepresentativeValues), value => Assert.True(value.Length <= 16));
        Assert.True(first.Fields.Sum(field => field.RepresentativeValues.Count) <= 3);
        Assert.DoesNotContain(first.Fields.SelectMany(field => field.RepresentativeValues), value =>
            value.Contains("@example.com", StringComparison.OrdinalIgnoreCase) || value.Contains("private note", StringComparison.OrdinalIgnoreCase));

        session.ReplaceDecisions(new OrganizationImportDecisions(
            FieldMappings: new Dictionary<string, int?> { [OrganizationImportFields.Name] = 0 }), Actor());
        var afterDecision = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var changed = Assert.IsType<OrganizationImportSemanticRequest>(builder.Build(session, afterDecision).Request);
        Assert.NotEqual(first.InputFingerprint, changed.InputFingerprint);
    }

    [Fact]
    public async Task Context_SpreadsSampleValuesAcrossTheColumn()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var rows = Enumerable.Range(1, 40)
            .Select(index => new string?[] { $"U{index:00}", $"Unit {index:00}", index == 1 ? null : "U01", "Squad" })
            .ToList();
        rows[0][3] = "Tribe";
        var session = Session(tenant.TenantId, new OrganizationSourceTable(
            [new(0, "Key"), new(1, "Label"), new(2, "Rolls Up"), new(3, "Grade")], rows));
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        var request = new OrganizationImportSemanticContextBuilder(Options()).Build(session, review).Request!;
        var label = request.Fields.Single(field => field.SourceLabel == "Label");

        Assert.Equal(5, label.RepresentativeValues.Count);
        Assert.Contains("Unit 01", label.RepresentativeValues);
        Assert.Contains("Unit 40", label.RepresentativeValues);
    }

    // ── State ──────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task NothingLeftToAsk_IsNotNeeded_AndNeverCallsTheProvider()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, NativeTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var provider = StubProvider.Failing(new InvalidOperationException("must not be called"));
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.NotNeeded, (await DescribeAsync(context, tenant, service, session.Id)).State);
        Assert.Equal(0, provider.CallCount);
        Assert.Empty(context.OrganizationImportSemanticAttempts);
    }

    [Fact]
    public async Task WithoutTenantConsent_AssistanceAwaitsConsent_AndUploadNeverCallsTheProvider()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        var provider = new StubProvider(request => Answers(request));
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        var state = await DescribeAsync(context, tenant, service, session.Id);
        Assert.Equal(OrganizationImportSemanticAssistanceState.AwaitingConsent, state.State);
        Assert.Equal(4, state.RemainingCount);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact]
    public async Task UnconfiguredProvider_IsSkipped()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var service = Service(context, tenant, new StubProvider(request => Answers(request), isConfigured: false));

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.Skipped, (await DescribeAsync(context, tenant, service, session.Id)).State);
        Assert.Empty(context.OrganizationImportSemanticAttempts);
    }

    [Fact]
    public async Task Consent_IsBoundToProviderAndDataContract_NotToTheModel()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        context.OrganizationImportSemanticConsents.Add(OrganizationImportSemanticConsent.Grant(
            tenant.TenantId, "Groq", "organization-import-semantic-data/0", Actor()));
        await context.SaveChangesAsync();

        var otherModel = Service(context, tenant, new StubProvider(request => Answers(request)) { Model = "openai/gpt-oss-20b" });
        Assert.Equal(OrganizationImportSemanticAssistanceState.AwaitingConsent, (await DescribeAsync(context, tenant, otherModel, session.Id)).State);

        await GrantConsentAsync(context, tenant.TenantId);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Ready, (await DescribeAsync(context, tenant, otherModel, session.Id)).State);
    }

    [Fact]
    public async Task ImplicitMode_RunsAtUploadWithoutAskingOrRecordingConsent()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        var options = Options();
        // Automatic matching without a consent step is the product default.
        Assert.Equal(OrganizationImportSemanticConsentMode.Implicit, new OrganizationImportSemanticAssistanceOptions().ConsentMode);
        options.ConsentMode = OrganizationImportSemanticConsentMode.Implicit;
        var provider = new StubProvider(request => Answers(request));
        var service = Service(context, tenant, provider, options);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
        Assert.Empty(context.OrganizationImportSemanticConsents);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Succeeded, (await DescribeAsync(context, tenant, service, session.Id)).State);
    }

    [Fact]
    public async Task PerImportMode_NeverRunsAtUpload_AndConsentCoversOnlyThatImport()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var first = Session(tenant.TenantId, CustomVocabularyTable());
        var second = Session(tenant.TenantId, CustomVocabularyTable());
        context.OrganizationImportSessions.AddRange(first, second);
        await context.SaveChangesAsync();
        // Even an existing tenant consent does not bypass per-import asking.
        await GrantConsentAsync(context, tenant.TenantId);
        var options = Options();
        options.ConsentMode = OrganizationImportSemanticConsentMode.PerImport;
        var provider = new StubProvider(request => Answers(request));
        var service = Service(context, tenant, provider, options);

        await service.RunAfterUploadAsync(first.Id, Actor(), CancellationToken.None);
        var awaiting = await DescribeAsync(context, tenant, service, first.Id);
        Assert.Equal(0, provider.CallCount);
        Assert.Equal(OrganizationImportSemanticAssistanceState.AwaitingConsent, awaiting.State);
        Assert.Equal(OrganizationImportSemanticConsentScope.Import, awaiting.ConsentScope);

        await service.RunAsync(first.Id, new(awaiting.InputFingerprint!, GrantTenantConsent: true), Actor(), CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
        Assert.Contains(context.OrganizationImportSemanticConsents, consent => consent.SessionId == first.Id);
        Assert.Equal(OrganizationImportSemanticAssistanceState.AwaitingConsent, (await DescribeAsync(context, tenant, service, second.Id)).State);
    }

    // ── Run ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UploadRun_AppliesValidSuggestionsWithProvenance_AndAbstentionIsSuccess()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var provider = new StubProvider(request => Answers(request, abstain: ["Delivery Pod"]) with
        {
            InputTokens = 42, OutputTokens = 17, ResponseId = "chatcmpl-1", SystemFingerprint = "fp_1",
        });
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Succeeded, attempt.Status);
        Assert.Equal(OrganizationImportSemanticTrigger.Upload, attempt.Trigger);
        Assert.Equal((4, 3, 3, 0, 3, 1), (attempt.QuestionsSubmitted, attempt.SuggestionsReturned, attempt.SuggestionsAccepted,
            attempt.SuggestionsRejected, attempt.SuggestionsApplied, attempt.Abstentions));
        Assert.Equal(OrganizationImportSemanticVersions.Prompt, attempt.PromptVersion);
        Assert.Equal(OrganizationImportSemanticVersions.DataContract, attempt.DataContractVersion);
        Assert.Equal(("chatcmpl-1", "fp_1", 42, 17), (attempt.ProviderResponseId, attempt.ProviderSystemFingerprint, attempt.InputTokens, attempt.OutputTokens));

        var decisions = await DecisionsAsync(context, session.Id);
        Assert.Equal(3, decisions.TypeMappings!.Count);
        Assert.All(decisions.TypeMappingOrigins!.Values, origin => Assert.Equal(OrganizationImportResolutionOrigin.SemanticSuggestion, origin));
        Assert.DoesNotContain("Delivery Pod", decisions.TypeMappings.Keys);

        var state = await DescribeAsync(context, tenant, service, session.Id);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Succeeded, state.State);
        Assert.Equal((4, 3, 1, 1), (state.ExaminedCount, state.AppliedCount, state.AbstainedCount, state.RemainingCount));
        Assert.Empty(context.OrgUnits);
    }

    [Fact]
    public async Task AllAbstentions_AreASuccessfulRunThatAppliesNothing()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var service = Service(context, tenant, new StubProvider(request => Answers(request, abstain: ["Entity", "Strategic Pillar", "Capability", "Delivery Pod"])));

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Succeeded, attempt.Status);
        Assert.Equal((0, 4), (attempt.SuggestionsApplied, attempt.Abstentions));
        Assert.Empty((await DecisionsAsync(context, session.Id)).TypeMappings!);
    }

    [Fact]
    public async Task InvalidAndIncoherentSuggestions_AreRejectedNotApplied()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var service = Service(context, tenant, new StubProvider(request =>
        {
            var answers = Answers(request).Answers.ToList();
            // A non-root source type can never be the canonical Organization, and a target outside
            // the allowed list is never accepted.
            answers[Index(request, "Strategic Pillar", answers)] = answers[Index(request, "Strategic Pillar", answers)] with { TargetKey = Target(request, "Organization") };
            answers[Index(request, "Capability", answers)] = answers[Index(request, "Capability", answers)] with { TargetKey = "type:00000000-0000-0000-0000-000000000000" };
            return new(answers, null, null);
        }));

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Succeeded, attempt.Status);
        // Collapsing the root and a non-root type onto Organization withholds both; the invented
        // target is rejected on its own. Only Delivery Pod survives.
        Assert.Equal((4, 3, 1), (attempt.SuggestionsReturned, attempt.SuggestionsRejected, attempt.SuggestionsApplied));
        var decisions = await DecisionsAsync(context, session.Id);
        Assert.Equal(["Delivery Pod"], decisions.TypeMappings!.Keys);
        Assert.DoesNotContain("Capability", decisions.TypeMappings.Keys);
    }

    [Fact]
    public async Task AnAdministratorChangeDuringTheCall_WinsAndTheResultIsStale()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        var database = Guid.NewGuid().ToString();
        await using var context = TestDbContextFactory.Create(tenant, database);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var service = Service(context, tenant, new StubProvider(async request =>
        {
            // While the provider is answering, the administrator settles one label themselves.
            await using var other = TestDbContextFactory.Create(tenant, database);
            var live = await other.OrganizationImportSessions.Include(item => item.Source).SingleAsync(item => item.Id == session.Id);
            live.ReplaceDecisions(new OrganizationImportDecisions(
                TypeMappings: new Dictionary<string, Guid> { ["Capability"] = TypeId("Team") },
                TypeMappingOrigins: new Dictionary<string, OrganizationImportResolutionOrigin> { ["Capability"] = OrganizationImportResolutionOrigin.Administrator }), Actor());
            await other.SaveChangesAsync();
            return Answers(request);
        }));

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAttemptStatus.Stale, (await context.OrganizationImportSemanticAttempts.SingleAsync()).Status);
        var decisions = await DecisionsAsync(context, session.Id);
        Assert.Single(decisions.TypeMappings!);
        Assert.Equal(TypeId("Team"), decisions.TypeMappings!["Capability"]);
        Assert.Equal(OrganizationImportResolutionOrigin.Administrator, decisions.TypeMappingOrigins!["Capability"]);
    }

    [Fact]
    public async Task IdenticalInput_ReusesTheEarlierResultWithoutCallingTheProviderAgain()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        await GrantConsentAsync(context, tenant.TenantId);
        var first = Session(tenant.TenantId, CustomVocabularyTable());
        var second = Session(tenant.TenantId, CustomVocabularyTable());
        context.OrganizationImportSessions.AddRange(first, second);
        await context.SaveChangesAsync();
        var provider = new StubProvider(request => Answers(request));
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(first.Id, Actor(), CancellationToken.None);
        await service.RunAfterUploadAsync(second.Id, Actor(), CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
        var reused = await context.OrganizationImportSemanticAttempts.SingleAsync(item => item.SessionId == second.Id);
        var original = await context.OrganizationImportSemanticAttempts.SingleAsync(item => item.SessionId == first.Id);
        Assert.Equal(original.Id, reused.ReusedFromAttemptId);
        Assert.Equal(4, reused.SuggestionsApplied);
        Assert.Equal(4, (await DecisionsAsync(context, second.Id)).TypeMappings!.Count);
    }

    // ── Failure & retry ────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TransientFailure_IsRetriedOnce()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var calls = 0;
        var provider = new StubProvider(request => ++calls == 1
            ? throw new OrganizationImportSemanticProviderException(OrganizationImportSemanticFailureCategory.ProviderUnavailable, "503")
            : Answers(request));
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Succeeded, attempt.Status);
        Assert.Equal(1, attempt.RetryCount);
        Assert.Equal(2, provider.CallCount);
    }

    [Fact]
    public async Task InvalidOutput_IsRetriedOnceThenFailsRetryably()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var provider = StubProvider.Failing(new OrganizationImportSemanticProviderException(OrganizationImportSemanticFailureCategory.InvalidOutput, "schema"));
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.Equal(2, provider.CallCount);
        var state = await DescribeAsync(context, tenant, service, session.Id);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Failed, state.State);
        Assert.Equal(OrganizationImportSemanticFailureCategory.InvalidOutput, state.FailureCategory);
        Assert.True(state.CanRetry);
        Assert.Empty((await DecisionsAsync(context, session.Id)).TypeMappings!);
    }

    [Fact]
    public async Task CredentialFailure_IsNeverRetried()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var provider = StubProvider.Failing(new OrganizationImportSemanticProviderException(OrganizationImportSemanticFailureCategory.Unauthorized, "401"));
        var service = Service(context, tenant, provider);

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
        var state = await DescribeAsync(context, tenant, service, session.Id);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Failed, state.State);
        Assert.False(state.CanRetry);
    }

    [Fact]
    public async Task UploadBudget_BoundsASlowProvider_AndTheUploadStillCompletes()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        await GrantConsentAsync(context, tenant.TenantId);
        var options = Options();
        options.UploadBudgetSeconds = 1;
        options.TimeoutSeconds = 1;
        var service = Service(context, tenant, new StubProvider(async (request, token) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10), token);
            return Answers(request);
        }), options);
        var stopwatch = Stopwatch.StartNew();

        await service.RunAfterUploadAsync(session.Id, Actor(), CancellationToken.None);

        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(4), $"took {stopwatch.Elapsed}");
        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Failed, attempt.Status);
        Assert.Equal(OrganizationImportSemanticFailureCategory.Timeout, attempt.FailureCategory);
    }

    // ── Administrator-started runs ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task RunFromMatch_RequiresConsent_ThenGrantsItForTheTenantAndRuns()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        var provider = new StubProvider(request => Answers(request, abstain: ["Delivery Pod"]));
        var service = Service(context, tenant, provider);
        var fingerprint = (await DescribeAsync(context, tenant, service, session.Id)).InputFingerprint!;

        var refused = await Assert.ThrowsAsync<OrganizationImportReviewException>(() =>
            service.RunAsync(session.Id, new(fingerprint), Actor(), CancellationToken.None));
        Assert.Equal("SemanticConsentRequired", refused.Code);
        Assert.Equal(0, provider.CallCount);

        await service.RunAsync(session.Id, new(fingerprint, GrantTenantConsent: true), Actor(), CancellationToken.None);

        var consent = await context.OrganizationImportSemanticConsents.SingleAsync();
        Assert.Equal(("Groq", OrganizationImportSemanticVersions.DataContract), (consent.Provider, consent.DataContractVersion));
        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticTrigger.Administrator, attempt.Trigger);
        Assert.Equal(3, attempt.SuggestionsApplied);
    }

    // ── End to end through the import service ──────────────────────────────────────────────────

    [Fact]
    public async Task Upload_RunsAssistanceWhenAllowed_AndOverridesAreCountedAgainstTheRun()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        await GrantConsentAsync(context, tenant.TenantId);
        var semantic = Service(context, tenant, new StubProvider(request => Answers(request, abstain: ["Delivery Pod"])));
        var imports = ImportService(context, tenant, semantic);
        var csv = "Business Code,Name,Type,Parent Business Code\n"
            + string.Join('\n', CustomVocabularyTable().Rows.Select(row => string.Join(',', row.Select(value => value ?? string.Empty))));

        var intake = await imports.IntakeAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "organization.csv", "text/csv",
            EffectiveDate, Guid.NewGuid(), null, Actor(), CancellationToken.None);

        var match = intake.Session!.Match!;
        Assert.Equal(OrganizationImportSemanticAssistanceState.Succeeded, match.SemanticAssistance!.State);
        Assert.Equal(3, match.SemanticAssistance.AppliedCount);
        Assert.False(match.Readiness.CanContinue);
        Assert.Single(match.Readiness.RequiredDecisions, decision => decision.Kind == OrganizationImportRequiredDecisionKind.TypeMapping);

        var updated = await imports.UpdateMatchAsync(intake.Session.Id, intake.Session.Version,
            new UpdateOrganizationImportMatchRequest(TypeMappings: new Dictionary<string, Guid>
            {
                ["Delivery Pod"] = TypeId("Team"),
                ["Capability"] = TypeId("Unit"),
            }), Actor(), CancellationToken.None);

        Assert.True(updated.Match!.Readiness.CanContinue);
        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(1, attempt.SuggestionsOverridden);
        Assert.Equal(OrganizationImportResolutionOrigin.Administrator, updated.Decisions.TypeMappingOrigins!["Capability"]);
        Assert.Equal(OrganizationImportResolutionOrigin.SemanticSuggestion, updated.Decisions.TypeMappingOrigins["Entity"]);
    }

    [Fact]
    public async Task Upload_SucceedsWhenAssistanceFails()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        await GrantConsentAsync(context, tenant.TenantId);
        var semantic = Service(context, tenant, StubProvider.Failing(new InvalidOperationException("provider exploded")));
        var imports = ImportService(context, tenant, semantic);
        var csv = "Business Code,Name,Type,Parent Business Code\n"
            + string.Join('\n', CustomVocabularyTable().Rows.Select(row => string.Join(',', row.Select(value => value ?? string.Empty))));

        var intake = await imports.IntakeAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "organization.csv", "text/csv",
            EffectiveDate, Guid.NewGuid(), null, Actor(), CancellationToken.None);

        Assert.Equal(OrganizationImportIntakeKind.SourceReady, intake.Kind);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Failed, intake.Session!.Match!.SemanticAssistance!.State);
        Assert.Equal(4, intake.Session.Match.SemanticAssistance.RemainingCount);
    }

    // ── Deterministic-first ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TypeSystem_evidence_supplies_topology_per_source_type_to_the_model()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, CustomVocabularyTable());
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var request = new OrganizationImportSemanticContextBuilder(Options()).Build(session, review).Request!;

        var system = request.SourceTypeSystem.ToDictionary(t => t.SourceLabel, StringComparer.OrdinalIgnoreCase);
        Assert.True(system["Entity"].OccursOnRoot);
        Assert.Equal(0, system["Entity"].MinDepth);
        Assert.Contains("Strategic Pillar", system["Entity"].ChildTypes);
        Assert.Equal(2, system["Capability"].Occurrences);
        Assert.True(system["Delivery Pod"].LeafOnly);
        Assert.Contains(request.CanonicalTypeGuidance, c => c.Name == "Organization" && c.Description.Length > 0);
    }

    [Fact]
    public async Task Native_type_vocabulary_needs_no_semantic_questions()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeAsync(context, tenant.TenantId, NativeTable());
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.Null(new OrganizationImportSemanticContextBuilder(Options()).Build(session, review).Request);
    }

    // ── Fixtures ───────────────────────────────────────────────────────────────────────────────

    // A parent-referenced file whose type vocabulary is the customer's own. The shape and fields
    // resolve deterministically; only the four type meanings need semantic help.
    private static OrganizationSourceTable CustomVocabularyTable()
        => new(
            [new(0, "Business Code"), new(1, "Name"), new(2, "Type"), new(3, "Parent Business Code")],
            [
                new string?[] { "AST", "Asteria", "Entity", null },
                new string?[] { "CG", "Customer Growth", "Strategic Pillar", "AST" },
                new string?[] { "SE", "Sales Enablement", "Capability", "CG" },
                new string?[] { "NP", "North Pod", "Delivery Pod", "SE" },
                new string?[] { "SP", "South Pod", "Delivery Pod", "SE" },
                new string?[] { "PO", "People Operations", "Capability", "CG" },
                new string?[] { "TP", "Talent Pod", "Delivery Pod", "PO" },
            ]);

    private static OrganizationSourceTable NativeTable()
        => new(
            [new(0, "Business Code"), new(1, "Name"), new(2, "Type"), new(3, "Parent Business Code")],
            [
                new string?[] { "AG", "Asteria Group", "Organization", null },
                new string?[] { "CG", "Customer Growth", "Division", "AG" },
                new string?[] { "CE", "Customer Experience", "Department", "CG" },
                new string?[] { "CX", "Experience Pod", "Team", "CE" },
            ]);

    private static readonly Dictionary<string, string> Meaning = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Entity"] = "Organization",
        ["Strategic Pillar"] = "Division",
        ["Capability"] = "Department",
        ["Delivery Pod"] = "Team",
    };

    private static OrganizationImportSemanticProviderResult Answers(
        OrganizationImportSemanticRequest request,
        IReadOnlyCollection<string>? abstain = null)
        => new(request.Issues.Select(issue =>
            abstain?.Contains(issue.SourceLabel ?? string.Empty) == true || issue.SourceLabel is null || !Meaning.ContainsKey(issue.SourceLabel)
                ? new OrganizationImportSemanticAnswer(issue.Key, OrganizationImportSemanticDisposition.Abstain, null)
                : new OrganizationImportSemanticAnswer(issue.Key, OrganizationImportSemanticDisposition.Suggest,
                    issue.AllowedTargets.Single(target => target.Label == Meaning[issue.SourceLabel]).Key))
            .ToList(), null, null);

    private static int Index(OrganizationImportSemanticRequest request, string label, IReadOnlyList<OrganizationImportSemanticAnswer> answers)
        => answers.ToList().FindIndex(answer => answer.QuestionKey == request.Issues.Single(issue => issue.SourceLabel == label).Key);

    private static string Target(OrganizationImportSemanticRequest request, string typeName)
        => $"type:{request.OrganizationTypes.Single(type => type.Name == typeName).Id}";

    private static Guid TypeId(string name) => OrganizationalUnitTypeCatalog.BuiltIns.Single(type => type.Name == name).Id;

    private static async Task<OrganizationImportSession> ArrangeAsync(CoreHRDbContext context, Guid tenantId, OrganizationSourceTable table)
    {
        await SeedTypesAsync(context);
        var session = Session(tenantId, table);
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        return session;
    }

    private static async Task GrantConsentAsync(CoreHRDbContext context, Guid tenantId)
    {
        context.OrganizationImportSemanticConsents.Add(OrganizationImportSemanticConsent.Grant(
            tenantId, "Groq", OrganizationImportSemanticVersions.DataContract, Actor()));
        await context.SaveChangesAsync();
    }

    private static async Task<OrganizationImportSemanticAssistanceDto> DescribeAsync(
        CoreHRDbContext context,
        TestTenantContext tenant,
        OrganizationImportSemanticAssistanceService service,
        Guid sessionId)
    {
        context.ChangeTracker.Clear();
        var session = await context.OrganizationImportSessions.Include(item => item.Source).SingleAsync(item => item.Id == sessionId);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        return await service.DescribeAsync(session, review, CancellationToken.None);
    }

    private static async Task<OrganizationImportDecisions> DecisionsAsync(CoreHRDbContext context, Guid sessionId)
    {
        context.ChangeTracker.Clear();
        var session = await context.OrganizationImportSessions.SingleAsync(item => item.Id == sessionId);
        return OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)!.Normalize();
    }

    private static OrganizationImportSemanticAssistanceService Service(
        CoreHRDbContext context,
        TestTenantContext tenant,
        IOrganizationImportSemanticProvider provider,
        OrganizationImportSemanticAssistanceOptions? options = null)
    {
        var effectiveOptions = options ?? Options();
        return new(
            context,
            tenant,
            new OrganizationImportInterpreter(context, tenant),
            new OrganizationImportSemanticContextBuilder(effectiveOptions),
            provider,
            effectiveOptions,
            NullLogger<OrganizationImportSemanticAssistanceService>.Instance);
    }

    private static OrganizationImportService ImportService(
        CoreHRDbContext context,
        TestTenantContext tenant,
        IOrganizationImportSemanticAssistanceService semantic)
    {
        var organization = new Mock<IOrganizationService>();
        organization.Setup(service => service.GetReadinessAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationReadinessDto(false, null, false, null, null, false));
        organization.Setup(service => service.GetHierarchyAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .Returns<DateOnly, CancellationToken>((date, _) => Task.FromResult(new OrganizationHierarchyDto(date, [])));
        return new OrganizationImportService(
            context,
            tenant,
            new OrganizationImportSourceInspectionService(new SafeTabularSourceReader()),
            organization.Object,
            new OrganizationImportInterpreter(context, tenant),
            semantic);
    }

    private static OrganizationImportSession Session(Guid tenantId, OrganizationSourceTable table)
    {
        var session = OrganizationImportSession.Create(tenantId, EffectiveDate, Guid.NewGuid(), new string('a', 64), Actor());
        session.AttachSource(OrganizationImportSource.Create(tenantId, session.Id,
            new InspectedOrganizationSource("customer-organization.xlsx", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new string('b', 64), "Organization", "A1:D8", table, [1, 2, 3])));
        return session;
    }

    private static OrganizationImportActor Actor() => new(Guid.NewGuid(), "Ada Admin");

    private static async Task SeedTypesAsync(CoreHRDbContext context)
    {
        if (await context.OrganizationalUnitTypes.AnyAsync()) return;
        context.OrganizationalUnitTypes.AddRange(OrganizationalUnitTypeCatalog.BuiltIns.Select(type => OrganizationalUnitType.CreateBuiltIn(type.Id, type.Name)));
        await context.SaveChangesAsync();
    }

    private static OrganizationImportSemanticAssistanceOptions Options()
        => new() { TimeoutSeconds = 5, UploadBudgetSeconds = 10, InteractiveBudgetSeconds = 10, ApiKey = "test-only", ConsentMode = OrganizationImportSemanticConsentMode.Tenant };

    internal sealed class StubProvider(
        Func<OrganizationImportSemanticRequest, CancellationToken, Task<OrganizationImportSemanticProviderResult>> respond,
        bool isConfigured = true) : IOrganizationImportSemanticProvider
    {
        public StubProvider(Func<OrganizationImportSemanticRequest, OrganizationImportSemanticProviderResult> respond, bool isConfigured = true)
            : this((request, _) => Task.FromResult(respond(request)), isConfigured) { }

        public StubProvider(Func<OrganizationImportSemanticRequest, Task<OrganizationImportSemanticProviderResult>> respond, bool isConfigured = true)
            : this((request, _) => respond(request), isConfigured) { }

        public static StubProvider Failing(Exception exception, bool isConfigured = true)
            => new((_, _) => Task.FromException<OrganizationImportSemanticProviderResult>(exception), isConfigured);

        public string Model { get; init; } = OrganizationImportSemanticAssistanceOptions.DefaultModel;
        public string ProviderName => "Groq";
        public string ModelName => Model;
        public bool IsConfigured { get; } = isConfigured;
        public int CallCount { get; private set; }

        public Task<OrganizationImportSemanticProviderResult> SuggestAsync(OrganizationImportSemanticRequest request, CancellationToken cancellationToken)
        {
            CallCount++;
            return respond(request, cancellationToken);
        }
    }
}

internal static class OrganizationImportSemanticTestOptions
{
    public static OrganizationImportSemanticAssistanceOptions WithBounds(
        this OrganizationImportSemanticAssistanceOptions options,
        int maxFields,
        int maxValues,
        int maxTotalValues,
        int maxValueCharacters)
    {
        options.MaxFields = maxFields;
        options.MaxValuesPerField = maxValues;
        options.MaxTotalValues = maxTotalValues;
        options.MaxValueCharacters = maxValueCharacters;
        return options;
    }
}
