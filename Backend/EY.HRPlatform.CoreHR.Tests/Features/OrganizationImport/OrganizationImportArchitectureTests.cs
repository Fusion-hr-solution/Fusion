using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportArchitectureTests
{
    [Fact]
    public void MatchReadiness_IsDerivedOnlyFromTheMappingPlan()
    {
        var plan = new OrganizationImportMappingPlan(
            OrganizationImportShape.ParentReference,
            OrganizationImportResolutionStatus.Resolved,
            ImportResolutionOrigin.Deterministic,
            [
                new(OrganizationImportFields.Name, 0, OrganizationImportResolutionStatus.Resolved, ImportResolutionOrigin.Deterministic, MatchStatus: OrganizationImportMappingStatus.Matched),
                new(OrganizationImportFields.Type, 1, OrganizationImportResolutionStatus.Resolved, ImportResolutionOrigin.Deterministic, MatchStatus: OrganizationImportMappingStatus.Matched),
                new(OrganizationImportFields.ParentBusinessCode, 2, OrganizationImportResolutionStatus.Resolved, ImportResolutionOrigin.Deterministic, MatchStatus: OrganizationImportMappingStatus.Matched),
                new(OrganizationImportFields.BusinessCode, 3, OrganizationImportResolutionStatus.Resolved, ImportResolutionOrigin.Deterministic, MatchStatus: OrganizationImportMappingStatus.Matched),
            ],
            new Dictionary<string, Guid>(), [], [new(4, "Notes", "Not used")],
            OrganizationImportGeneratedIdentityStrategy.SourceBusinessCode, "source",
            TypeMappingDetails: [new("Shared Service", null, null, 3, OrganizationImportMappingStatus.Suggested, ImportResolutionOrigin.SemanticSuggestion)],
            Identity: new(OrganizationImportGeneratedIdentityStrategy.SourceBusinessCode, 3, OrganizationImportMappingStatus.Matched, ImportResolutionOrigin.Deterministic, "Source code"));

        var evaluator = new OrganizationImportMatchReadinessService();
        var incomplete = evaluator.Evaluate(plan);
        Assert.False(incomplete.CanContinue);
        Assert.Equal(OrganizationImportRequiredDecisionKind.TypeMapping, Assert.Single(incomplete.RequiredDecisions).Kind);

        var accepted = plan with
        {
            TypeMappingDetails = [new("Shared Service", Guid.NewGuid(), "Department", 3,
                OrganizationImportMappingStatus.Matched, ImportResolutionOrigin.SemanticSuggestion)],
        };
        var complete = evaluator.Evaluate(accepted);
        Assert.True(complete.CanContinue);
        Assert.Equal(ImportMatchCompletionKind.Confirmed, evaluator.CompletionKind(accepted, complete));
    }

    [Fact]
    public void SameSourceAndMapping_ProduceTheSamePlanAndCanonicalDraftFingerprint()
    {
        var tenantId = Guid.NewGuid();
        var session = OrganizationImportSession.Create(
            tenantId, new DateOnly(2026, 9, 22), Guid.NewGuid(), new string('a', 64),
            new ImportActor(Guid.NewGuid(), "Admin"));
        var table = new OrganizationSourceTable(
            [new(0, "Org Key"), new(1, "Structure Label"), new(2, "Upstream Ref"), new(3, "Layer Label")],
            [
                new string?[] { "ROOT", "Asteria", null, "Organization" },
                new string?[] { "ENG", "Engineering", "ROOT", "Division" },
            ]);
        session.AttachSource(OrganizationImportSource.Create(tenantId, session.Id,
            new InspectedOrganizationSource("organization.xlsx", "xlsx", "application/xlsx", new string('b', 64),
                "Organization", "A1:D3", table, [1])));
        var decisions = new OrganizationImportDecisions().Normalize();
        var mapping = new OrganizationImportMappingService();

        var firstPlan = mapping.CreatePlan(session, table, decisions);
        var secondPlan = mapping.CreatePlan(session, table, decisions);

        Assert.Equal(firstPlan.SourceFingerprint, secondPlan.SourceFingerprint);
        Assert.Equal(firstPlan.SourceShape, secondPlan.SourceShape);
        Assert.Equal(firstPlan.ColumnMappings, secondPlan.ColumnMappings);
        Assert.Equal(OrganizationImportShape.ParentReference, firstPlan.SourceShape);
        Assert.Equal(OrganizationImportGeneratedIdentityStrategy.SourceBusinessCode, firstPlan.GeneratedIdentityStrategy);

        var normalizedNodes = new[]
        {
            Node("row:1", "ROOT", "Asteria", null, true),
            Node("row:2", "ENG", "Engineering", "row:1", false),
        };
        var firstDraft = OrganizationImportDraftBuilder.Build(session.EffectiveDate, normalizedNodes, null);
        var secondDraft = OrganizationImportDraftBuilder.Build(session.EffectiveDate, normalizedNodes.Reverse().ToList(), null);

        Assert.Equal(firstDraft.Fingerprint, secondDraft.Fingerprint);
        Assert.Equal(firstDraft.Nodes, secondDraft.Nodes);
    }

    [Fact]
    public void ValidatorRejectsCyclesWithoutAnySemanticDependency()
    {
        var date = new DateOnly(2026, 9, 22);
        var nodes = new[]
        {
            Node("a", "A", "A", "b", false),
            Node("b", "B", "B", "a", false),
        };
        var draft = OrganizationImportDraftBuilder.Build(date, nodes, null);

        var validation = new OrganizationImportValidator().Validate(draft, []);

        Assert.True(validation.HasBlockingIssues);
        var cycle = Assert.Single(validation.Issues, issue => issue.Code == OrganizationImportIssueCodes.HierarchyCycle);
        Assert.Equal(["a", "b"], cycle.RelatedNodeIds);
        Assert.Equal(draft.Fingerprint, validation.DraftFingerprint);
    }

    private static OrganizationImportProposalNode Node(
        string id,
        string code,
        string name,
        string? parentNodeId,
        bool isRoot)
        => new(
            id, name, code, false, "Team", Guid.Parse("33333333-3333-3333-3333-333333333333"), "Team",
            parentNodeId, null, null, null, OrganizationImportNodeClassification.Create, isRoot, false, [], [], []);
}
