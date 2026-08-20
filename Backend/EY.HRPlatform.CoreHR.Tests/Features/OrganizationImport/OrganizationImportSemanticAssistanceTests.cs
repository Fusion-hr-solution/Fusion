using System.Diagnostics;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportSemanticAssistanceTests
{
    private static readonly DateOnly EffectiveDate = new(2026, 8, 14);

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
            ],
            [
                new string?[] { "Asteria", null, "Organization", null, Guid.NewGuid().ToString(), "ada@example.com", "private note" },
                new string?[] { "Sales", "SALES", "Team", "Asteria", Guid.NewGuid().ToString(), "sam@example.com", "private note" },
            ]));
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var options = Options().WithBounds(maxFields: 7, maxValues: 1, maxTotalValues: 3, maxValueCharacters: 16);
        var builder = new OrganizationImportSemanticContextBuilder(options);

        var first = Assert.IsType<OrganizationImportSemanticRequest>(builder.Build(session, review));
        session.ChangeEffectiveDate(EffectiveDate.AddDays(30), Actor());
        var afterDateChange = Assert.IsType<OrganizationImportSemanticRequest>(builder.Build(session, review));

        Assert.Equal(first.InputFingerprint, afterDateChange.InputFingerprint);
        Assert.True(first.Fields.Count <= 7);
        Assert.True(first.Fields.Sum(field => field.RepresentativeValues.Count) <= 3);
        Assert.All(first.Fields, field =>
        {
            Assert.True(field.SourceLabel.Length <= 16);
            Assert.All(field.RepresentativeValues, value => Assert.True(value.Length <= 16));
        });
        Assert.DoesNotContain(first.Fields, field => field.SourceLabel.Contains("Fusion", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(first.Fields, field => field.SourceLabel.Contains("Email", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(first.Fields, field => field.SourceLabel.Contains("Comment", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(first.Fields.SelectMany(field => field.RepresentativeValues), value => value.Contains('@'));
        Assert.All(first.Issues.Where(issue => issue.Kind == OrganizationImportSemanticKinds.FieldMapping), issue =>
            Assert.DoesNotContain(issue.AllowedTargets, target => target.Key.Contains(OrganizationImportFields.FusionOrgUnitId, StringComparison.Ordinal)));
        var offeredFields = first.Issues
            .Where(issue => issue.Kind == OrganizationImportSemanticKinds.FieldMapping)
            .SelectMany(issue => issue.AllowedTargets)
            .Select(target => target.Key)
            .ToHashSet(StringComparer.Ordinal);
        Assert.True(
            new HashSet<string>(StringComparer.Ordinal)
            {
                $"field:{OrganizationImportFields.Name}",
                $"field:{OrganizationImportFields.BusinessCode}",
                $"field:{OrganizationImportFields.Type}",
                $"field:{OrganizationImportFields.ParentBusinessCode}",
            }.SetEquals(offeredFields));

        session.ReplaceDecisions(new OrganizationImportDecisions(
            FieldMappings: new Dictionary<string, int?> { [OrganizationImportFields.Name] = 0 }), Actor());
        var afterSemanticDecision = Assert.IsType<OrganizationImportSemanticRequest>(builder.Build(session, review));
        Assert.NotEqual(first.InputFingerprint, afterSemanticDecision.InputFingerprint);
    }

    [Fact]
    public async Task Generate_PersistsValidSiblingsAndReusesTheAttempt()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var provider = new StubProvider(request =>
        {
            var valid = SuggestionsFor(request).ToList();
            var invalidIndex = valid.FindIndex(item => item.IssueKey == "level-type:2");
            valid[invalidIndex] = valid[invalidIndex] with { TargetKey = "type:00000000-0000-0000-0000-000000000000" };
            return new(valid, 42, 17);
        });
        var service = Service(context, tenant, provider);
        var interpreter = new OrganizationImportInterpreter(context, tenant);
        var review = await interpreter.InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);
        var decisionsBefore = session.DecisionsJson;

        var generated = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);
        var reused = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.Available, generated.State);
        Assert.Equal(generated.AttemptId, reused.AttemptId);
        Assert.Equal(1, provider.CallCount);
        Assert.Equal(4, generated.Suggestions.Count);
        Assert.DoesNotContain(generated.Suggestions, suggestion => suggestion.IssueKey == "level-type:2");
        Assert.Equal(decisionsBefore, (await context.OrganizationImportSessions.SingleAsync(item => item.Id == session.Id)).DecisionsJson);
        Assert.Empty(context.OrgUnits);
        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal("Groq", attempt.Provider);
        Assert.Equal(OrganizationImportSemanticAssistanceOptions.DefaultModel, attempt.Model);
        Assert.Equal(42, attempt.InputTokens);
        Assert.Equal(17, attempt.OutputTokens);
    }

    [Fact]
    public async Task Apply_RecordsAdministratorDispositionsAndLeavesRejectedLevelManual()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var provider = new StubProvider(request => new(SuggestionsFor(request, entityTarget: "Division"), 12, 8));
        var service = Service(context, tenant, provider);
        var interpreter = new OrganizationImportInterpreter(context, tenant);
        var review = await interpreter.InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);
        var generated = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);
        var entity = generated.Suggestions.Single(item => item.SourceLabel == "Entity");
        var capability = generated.Suggestions.Single(item => item.SourceLabel == "Capability");
        var organizationTarget = entity.AllowedTargets.Single(item => item.Label == "Organization").Key;
        var reviewed = generated.Suggestions.Select(item => item.IssueKey == entity.IssueKey
                ? new OrganizationImportSemanticReviewedItem(item.IssueKey, organizationTarget, OrganizationImportSemanticReviewOutcome.Changed)
                : item.IssueKey == capability.IssueKey
                    ? new OrganizationImportSemanticReviewedItem(item.IssueKey, null, OrganizationImportSemanticReviewOutcome.Rejected)
                    : new OrganizationImportSemanticReviewedItem(item.IssueKey, item.TargetKey, OrganizationImportSemanticReviewOutcome.Accepted))
            .ToList();

        await service.ApplyAsync(
            session.Id,
            generated.AttemptId!.Value,
            session.Version,
            new(generated.InputFingerprint!, generated.AttemptVersion!.Value, reviewed),
            Actor(),
            CancellationToken.None);

        context.ChangeTracker.Clear();
        var persistedSession = await context.OrganizationImportSessions.Include(item => item.Source).SingleAsync(item => item.Id == session.Id);
        var decisions = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(persistedSession.DecisionsJson)!.Normalize();
        Assert.Equal(OrganizationImportShape.LevelColumns, decisions.Shape);
        Assert.Equal(OrganizationalUnitTypeCatalog.OrganizationId, decisions.TypeMappings!["Entity"]);
        Assert.DoesNotContain("Capability", decisions.TypeMappings.Keys, StringComparer.OrdinalIgnoreCase);
        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Applied, attempt.Status);
        var outcomes = OrganizationImportJson.Deserialize<IReadOnlyList<OrganizationImportSemanticReviewRecord>>(attempt.ReviewOutcomesJson!)!;
        Assert.Contains(outcomes, item => item.Outcome == OrganizationImportSemanticReviewOutcome.Accepted);
        Assert.Contains(outcomes, item => item.Outcome == OrganizationImportSemanticReviewOutcome.Changed);
        Assert.Contains(outcomes, item => item.Outcome == OrganizationImportSemanticReviewOutcome.Rejected);
        var recomputed = await interpreter.InterpretAsync(persistedSession, CancellationToken.None);
        Assert.Contains(recomputed.ProposalNodes, node => node.RawType == "Capability" && node.TypeId is null);
        Assert.Contains(recomputed.Issues, issue => issue.Code == "UnknownType");
        Assert.Empty(context.OrgUnits);
    }

    [Fact]
    public async Task NoValidSuggestions_FailsAsInvalidOutput_AndExplicitRetryCanRecover()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var firstCall = true;
        var provider = new StubProvider(request =>
        {
            if (firstCall)
            {
                firstCall = false;
                return new([new("unknown", OrganizationImportSemanticKinds.FieldMapping, "field:Name", null)], null, null);
            }
            return new(SuggestionsFor(request), null, null);
        });
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var failed = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);
        var unchanged = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);
        var recovered = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!, Retry: true), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticFailureCategory.InvalidOutput, failed.FailureCategory);
        Assert.Equal(failed.AttemptId, unchanged.AttemptId);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Available, recovered.State);
        Assert.NotEqual(failed.AttemptId, recovered.AttemptId);
        Assert.Equal(2, provider.CallCount);

    }

    [Fact]
    public async Task MissingConfigurationAndProviderFailuresRemainSafeManualFallbacks()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var provider = new StubProvider(
            (Func<OrganizationImportSemanticRequest, OrganizationImportSemanticProviderResult>)(_ => throw new InvalidOperationException()),
            isConfigured: false);
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var failed = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.Failed, failed.State);
        Assert.Equal(OrganizationImportSemanticFailureCategory.NotConfigured, failed.FailureCategory);
        Assert.Equal(0, provider.CallCount);
        Assert.Empty(context.OrgUnits);
        Assert.Contains(review.Issues, issue => issue.Severity == OrganizationImportIssueSeverity.Blocker);
    }

    [Fact]
    public async Task SlowResult_IsSupersededWhenSemanticDecisionsChangeDuringTheCall()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var provider = new StubProvider(async request =>
        {
            session.ReplaceDecisions(new OrganizationImportDecisions(Shape: OrganizationImportShape.ParentReference), Actor());
            await context.SaveChangesAsync();
            return new(SuggestionsFor(request), null, null);
        });
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var result = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.Eligible, result.State);
        Assert.NotEqual(eligible.InputFingerprint, result.InputFingerprint);
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Superseded, (await context.OrganizationImportSemanticAttempts.SingleAsync()).Status);
    }

    [Fact]
    public async Task ConcurrentGenerationReusesThePersistedPendingClaim()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        var databaseName = Guid.NewGuid().ToString();
        await using var firstContext = TestDbContextFactory.Create(tenant, databaseName);
        var firstSession = await ArrangeDemoAsync(firstContext, tenant.TenantId);
        await using var secondContext = TestDbContextFactory.Create(tenant, databaseName);
        var secondSession = await secondContext.OrganizationImportSessions.Include(item => item.Source)
            .SingleAsync(item => item.Id == firstSession.Id);
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = new StubProvider(async (request, cancellationToken) =>
        {
            started.SetResult();
            await release.Task.WaitAsync(cancellationToken);
            return new(SuggestionsFor(request), null, null);
        });
        var firstService = Service(firstContext, tenant, provider);
        var secondService = Service(secondContext, tenant, provider);
        var firstReview = await new OrganizationImportInterpreter(firstContext, tenant)
            .InterpretAsync(firstSession, CancellationToken.None);
        var eligible = await firstService.DescribeAsync(firstSession, firstReview, CancellationToken.None);

        var firstGeneration = firstService.GenerateAsync(firstSession.Id, new(eligible.InputFingerprint!), CancellationToken.None);
        await started.Task;
        var concurrentResult = await secondService.GenerateAsync(secondSession.Id, new(eligible.InputFingerprint!), CancellationToken.None);
        release.SetResult();
        var completedResult = await firstGeneration;

        Assert.Equal(OrganizationImportSemanticAssistanceState.Pending, concurrentResult.State);
        Assert.Equal(completedResult.AttemptId, concurrentResult.AttemptId);
        Assert.Equal(OrganizationImportSemanticAssistanceState.Available, completedResult.State);
        Assert.Equal(1, provider.CallCount);
    }

    [Fact]
    public async Task TimeoutFailsTheAttemptWithoutBlockingManualReview()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var provider = new StubProvider(async (_, cancellationToken) =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            throw new UnreachableException();
        });
        var options = Options();
        options.TimeoutSeconds = 1;
        var service = Service(context, tenant, provider, options);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var result = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.Failed, result.State);
        Assert.Equal(OrganizationImportSemanticFailureCategory.Timeout, result.FailureCategory);
        Assert.Contains(review.Issues, issue => issue.Severity == OrganizationImportIssueSeverity.Blocker);
    }

    [Fact]
    public async Task RequestCancellationMarksTheClaimedAttemptInterrupted()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var session = await ArrangeDemoAsync(context, tenant.TenantId);
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = new StubProvider(async (_, cancellationToken) =>
        {
            started.SetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            throw new UnreachableException();
        });
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);
        using var cancellation = new CancellationTokenSource();
        var generation = service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), cancellation.Token);
        await started.Task;

        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => generation);
        context.ChangeTracker.Clear();
        var attempt = await context.OrganizationImportSemanticAttempts.SingleAsync();
        Assert.Equal(OrganizationImportSemanticAttemptStatus.Failed, attempt.Status);
        Assert.Equal(OrganizationImportSemanticFailureCategory.Interrupted, attempt.FailureCategory);
    }

    [Fact]
    public async Task ParentReferenceSource_DetectedDeterministically_AndOffersOnlyFieldMeanings()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var session = Session(tenant.TenantId, ExpansionTable());
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var request = Assert.IsType<OrganizationImportSemanticRequest>(
            new OrganizationImportSemanticContextBuilder(Options()).Build(session, review));

        // The self-referential foreign key is deterministic evidence: the shape is
        // settled without AI, so no source-shape question is asked.
        Assert.Equal(OrganizationImportShape.ParentReference, review.Shape);
        Assert.DoesNotContain(request.Issues, issue => issue.Kind == OrganizationImportSemanticKinds.SourceShape);

        // Every ambiguity is a field-meaning question; a customer field is never
        // offered an Organization type such as "Business Unit".
        Assert.NotEmpty(request.Issues);
        Assert.All(request.Issues, issue =>
        {
            Assert.Equal(OrganizationImportSemanticKinds.FieldMapping, issue.Kind);
            Assert.All(issue.AllowedTargets, target => Assert.StartsWith("field:", target.Key));
            Assert.DoesNotContain(issue.AllowedTargets, target => target.Key.StartsWith("type:", StringComparison.Ordinal));
        });
    }

    [Fact]
    public async Task CrossKindProviderTargets_AreRejectedAsInvalidOutput()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var session = Session(tenant.TenantId, ExpansionTable());
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        // A misbehaving model answers every field-meaning question with a hierarchy
        // type target — a semantically impossible cross-kind answer.
        var typeId = OrganizationalUnitTypeCatalog.BuiltIns.First().Id;
        var provider = new StubProvider(request => new(
            request.Issues.Select(issue =>
                new OrganizationImportSemanticProviderSuggestion(issue.Key, issue.Kind, $"type:{typeId}", null)).ToList(),
            null, null));
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var result = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        // None survive validation, so the attempt fails cleanly and manual review remains.
        Assert.Equal(OrganizationImportSemanticAssistanceState.Failed, result.State);
        Assert.Equal(OrganizationImportSemanticFailureCategory.InvalidOutput, result.FailureCategory);
        Assert.Empty(result.Suggestions);
    }

    // A synthetic, non-native customer taxonomy (never Fusion vocabulary) with a clean root→leaf shape.
    private static OrganizationSourceTable SyntheticTaxonomyTable()
        => new(
            [new(0, "Unit Ref"), new(1, "Unit Name"), new(2, "Unit Class"), new(3, "Rolls Up To")],
            [
                new string?[] { "ENT", "Northwind", "Enterprise Class", null },
                new string?[] { "OC1", "Retail Cluster", "Operating Cluster", "ENT" },
                new string?[] { "OC2", "Wholesale Cluster", "Operating Cluster", "ENT" },
                new string?[] { "CA1", "Merchandising", "Capability Area", "OC1" },
                new string?[] { "CA2", "Logistics", "Capability Area", "OC2" },
                new string?[] { "SQ1", "Pricing Squad", "Squad", "CA1" },
                new string?[] { "SQ2", "Inbound Squad", "Squad", "CA2" },
            ]);

    // The field roles are already resolved (as they are by the point type-vocabulary questions
    // surface): Business Code=0, Name=1, Type=2, Parent reference=3. Only the type meanings remain.
    private static OrganizationImportDecisions TaxonomyFieldMappings()
        => new(
            Shape: OrganizationImportShape.ParentReference,
            FieldMappings: new Dictionary<string, int?>(StringComparer.Ordinal)
            {
                [OrganizationImportFields.BusinessCode] = 0,
                [OrganizationImportFields.Name] = 1,
                [OrganizationImportFields.Type] = 2,
                [OrganizationImportFields.ParentBusinessCode] = 3,
            });

    [Fact]
    public async Task TypeSystem_evidence_supplies_topology_per_source_type_to_the_model()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var session = Session(tenant.TenantId, SyntheticTaxonomyTable());
        session.ReplaceDecisions(TaxonomyFieldMappings(), Actor());
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var request = Assert.IsType<OrganizationImportSemanticRequest>(new OrganizationImportSemanticContextBuilder(Options()).Build(session, review));

        var system = request.SourceTypeSystem.ToDictionary(t => t.SourceLabel, StringComparer.OrdinalIgnoreCase);
        // The whole taxonomy is described with topology, not just labels.
        Assert.True(system.ContainsKey("Enterprise Class"));
        Assert.True(system["Enterprise Class"].OccursOnRoot);
        Assert.Equal(0, system["Enterprise Class"].MinDepth);
        Assert.Contains("Operating Cluster", system["Enterprise Class"].ChildTypes);
        Assert.Equal(2, system["Operating Cluster"].Occurrences);
        Assert.Contains("Enterprise Class", system["Operating Cluster"].ParentTypes);
        Assert.Contains("Capability Area", system["Operating Cluster"].ChildTypes);
        Assert.True(system["Squad"].LeafOnly);
        Assert.False(system["Squad"].OccursOnRoot);
        // Canonical role guidance travels with the request so the model aligns to roles, not names.
        Assert.Contains(request.CanonicalTypeGuidance, c => c.Name == "Organization" && c.Description.Length > 0);
    }

    [Fact]
    public async Task Coherent_whole_taxonomy_type_mapping_is_kept_for_auto_accept()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var session = Session(tenant.TenantId, SyntheticTaxonomyTable());
        session.ReplaceDecisions(TaxonomyFieldMappings(), Actor());
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();

        // Model aligns each distinct source class to a distinct canonical role following source order.
        var provider = new StubProvider(request => new(request.Issues.Select(issue =>
        {
            var target = issue.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping
                ? issue.AllowedTargets.Single(t => t.Label == (issue.SourceLabel switch
                {
                    "Enterprise Class" => "Organization",
                    "Operating Cluster" => "Division",
                    "Capability Area" => "Department",
                    "Squad" => "Team",
                    _ => "Team",
                }))
                : issue.AllowedTargets.First();
            return new OrganizationImportSemanticProviderSuggestion(issue.Key, issue.Kind, target.Key, null);
        }).ToList(), null, null));
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var result = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        Assert.Equal(OrganizationImportSemanticAssistanceState.Available, result.State);
        // All four distinct roles survive corroboration (coherent = distinct canonical types).
        var typeSuggestions = result.Suggestions.Where(s => s.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping).ToList();
        Assert.Equal(4, typeSuggestions.Count);
        Assert.Equal(4, typeSuggestions.Select(s => s.TargetKey).Distinct().Count());
    }

    [Fact]
    public async Task Incoherent_collapse_of_differentiated_types_is_withheld_for_grouped_confirmation()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var session = Session(tenant.TenantId, SyntheticTaxonomyTable());
        session.ReplaceDecisions(TaxonomyFieldMappings(), Actor());
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();

        // A weak model answer that collapses the whole differentiated hierarchy onto "Organization"
        // (root + non-root, different depths) — exactly the manual-replay defect.
        var orgTargetByIssue = new Dictionary<string, string>();
        var provider = new StubProvider(request => new(request.Issues.Select(issue =>
        {
            var target = issue.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping
                ? issue.AllowedTargets.Single(t => t.Label == "Organization")
                : issue.AllowedTargets.First();
            if (issue.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping) orgTargetByIssue[issue.Key] = target.Key;
            return new OrganizationImportSemanticProviderSuggestion(issue.Key, issue.Kind, target.Key, null);
        }).ToList(), null, null));
        var service = Service(context, tenant, provider);
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var eligible = await service.DescribeAsync(session, review, CancellationToken.None);

        var result = await service.GenerateAsync(session.Id, new(eligible.InputFingerprint!), CancellationToken.None);

        // The incoherent type suggestions are withheld — none of the collapsed type mappings is
        // auto-accepted, so the administrator resolves them through grouped confirmation instead.
        Assert.DoesNotContain(result.Suggestions, s => s.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping);
    }

    [Fact]
    public async Task Native_type_vocabulary_needs_no_semantic_type_questions()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        // ExpansionTable already uses native canonical type names (Organization/Division/Department/Team).
        var session = Session(tenant.TenantId, ExpansionTable());
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);
        var request = new OrganizationImportSemanticContextBuilder(Options()).Build(session, review);

        // Deterministic interpretation already resolved the native types, so either there is nothing to
        // ask (null request) or no organization-type question remains for the model.
        if (request is not null)
            Assert.DoesNotContain(request.Issues, i => i.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping);
    }

    private static OrganizationSourceTable ExpansionTable()
        => new(
            [new(0, "OU Ref"), new(1, "Org Label"), new(2, "Classification"), new(3, "Rolls Up To")],
            [
                new string?[] { "AG", "Asteria Group", "Organization", null },
                new string?[] { "CG", "Customer Growth", "Division", "AG" },
                new string?[] { "CE", "Customer Experience", "Department", "CG" },
                new string?[] { "CX", "Experience Pod", "Team", "CE" },
            ]);

    private static OrganizationImportSemanticAssistanceService Service(
        EY.HRPlatform.CoreHR.Infrastructure.Persistence.CoreHRDbContext context,
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

    private static async Task<OrganizationImportSession> ArrangeDemoAsync(
        EY.HRPlatform.CoreHR.Infrastructure.Persistence.CoreHRDbContext context,
        Guid tenantId)
    {
        await SeedTypesAsync(context);
        var session = Session(tenantId, new OrganizationSourceTable(
            [new(0, "Entity"), new(1, "Strategic Pillar"), new(2, "Capability"), new(3, "Delivery Pod")],
            [
                new string?[] { "Asteria", "Customer Growth", "Sales Enablement", "North Pod" },
                new string?[] { "Asteria", "Customer Growth", "Sales Enablement", "South Pod" },
                new string?[] { "Asteria", "Operational Excellence", "People Operations", "Talent Pod" },
            ]));
        context.OrganizationImportSessions.Add(session);
        await context.SaveChangesAsync();
        return session;
    }

    private static IReadOnlyList<OrganizationImportSemanticProviderSuggestion> SuggestionsFor(
        OrganizationImportSemanticRequest request,
        string entityTarget = "Organization")
        => request.Issues.Select(issue =>
        {
            var label = issue.SourceLabel switch
            {
                "Entity" => entityTarget,
                "Strategic Pillar" => "Division",
                "Capability" => "Department",
                "Delivery Pod" => "Team",
                _ => null,
            };
            var target = issue.Kind == OrganizationImportSemanticKinds.SourceShape
                ? issue.AllowedTargets.Single(item => item.Key == "shape:LevelColumns")
                : issue.AllowedTargets.Single(item => item.Label == label);
            return new OrganizationImportSemanticProviderSuggestion(issue.Key, issue.Kind, target.Key, "Matches the source hierarchy vocabulary.");
        }).ToList();

    private static OrganizationImportSession Session(Guid tenantId, OrganizationSourceTable table)
    {
        var session = OrganizationImportSession.Create(tenantId, EffectiveDate, Guid.NewGuid(), new string('a', 64), Actor());
        session.AttachSource(OrganizationImportSource.Create(tenantId, session.Id,
            new InspectedOrganizationSource("customer-organization.xlsx", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new string('b', 64), "Organization", "A1:D4", table, [1, 2, 3])));
        return session;
    }

    private static OrganizationImportActor Actor() => new(Guid.NewGuid(), "Ada Admin");

    private static async Task SeedTypesAsync(EY.HRPlatform.CoreHR.Infrastructure.Persistence.CoreHRDbContext context)
    {
        context.OrganizationalUnitTypes.AddRange(OrganizationalUnitTypeCatalog.BuiltIns.Select(type => OrganizationalUnitType.CreateBuiltIn(type.Id, type.Name)));
        await context.SaveChangesAsync();
    }

    private static OrganizationImportSemanticAssistanceOptions Options()
        => new() { TimeoutSeconds = 2, ApiKey = "test-only" };

    private sealed class StubProvider : IOrganizationImportSemanticProvider
    {
        private readonly Func<OrganizationImportSemanticRequest, CancellationToken, Task<OrganizationImportSemanticProviderResult>> _respond;

        public StubProvider(
            Func<OrganizationImportSemanticRequest, OrganizationImportSemanticProviderResult> respond,
            bool isConfigured = true)
            : this((request, _) => Task.FromResult(respond(request)), isConfigured) { }

        public StubProvider(
            Func<OrganizationImportSemanticRequest, Task<OrganizationImportSemanticProviderResult>> respond,
            bool isConfigured = true)
            : this((request, _) => respond(request), isConfigured) { }

        public StubProvider(
            Func<OrganizationImportSemanticRequest, CancellationToken, Task<OrganizationImportSemanticProviderResult>> respond,
            bool isConfigured = true)
        {
            _respond = respond;
            IsConfigured = isConfigured;
        }

        public string ProviderName => "Groq";
        public string ModelName => OrganizationImportSemanticAssistanceOptions.DefaultModel;
        public bool IsConfigured { get; }
        public int CallCount { get; private set; }

        public Task<OrganizationImportSemanticProviderResult> SuggestAsync(OrganizationImportSemanticRequest request, CancellationToken cancellationToken)
        {
            CallCount++;
            return _respond(request, cancellationToken);
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
