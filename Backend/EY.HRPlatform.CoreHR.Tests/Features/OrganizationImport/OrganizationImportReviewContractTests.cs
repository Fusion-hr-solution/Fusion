using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

/// <summary>
/// The Review contract end to end: one canonical projection, deterministic issues with
/// server-decided resolution pathways, bounded resolutions, and exact-proposal publication.
/// </summary>
public sealed class OrganizationImportReviewContractTests
{
    private static readonly DateOnly EffectiveDate = new(2026, 9, 1);

    private const string TwoFinances = """
        Business Code,Name,Type,Parent Business Code
        AST,Asteria,Organization,
        EU,Europe,Business Unit,AST
        NA,North America,Business Unit,AST
        EU-FIN,Finance,Department,EU
        NA-FIN,Finance,Department,NA
        """;

    private const string TwoTops = """
        Business Code,Name,Type,Parent Business Code
        ALPHA,Alpha,Division,
        BETA,Beta,Division,
        """;

    [Fact]
    public async Task HealthyStructureWithDuplicateName_IsPublishableWithOneInformativeWarning()
    {
        await using var fixture = await Fixture.CreateAsync();
        var review = (await fixture.IntakeAsync(TwoFinances)).Review!;

        Assert.Equal(OrganizationImportReviewState.ReadyWithWarnings, review.Readiness.State);
        Assert.True(review.Readiness.CanPublish);
        Assert.Equal(0, review.Readiness.BlockingIssueCount);
        var warning = Assert.Single(review.Issues);
        Assert.Equal(OrganizationImportIssueCodes.DuplicateDisplayName, warning.Code);
        Assert.Equal(OrganizationImportIssueSeverity.Warning, warning.Severity);
        Assert.Equal(2, warning.RelatedNodeIds.Count);
        Assert.Null(warning.PreferredResolution);
        Assert.Empty(warning.AllowedResolutions);

        Assert.Equal(new OrganizationImportReviewSummary(5, 5, 0, 0, 1, review.Summary.CountsByType), review.Summary);
        Assert.Contains(review.Summary.CountsByType, count => count.TypeName == "Department" && count.Count == 2);
        Assert.Equal(0, review.Nodes.Single(node => node.Name == "Asteria").Depth);
        Assert.All(review.Nodes.Where(node => node.Name == "Finance"), node =>
        {
            Assert.Equal(2, node.Depth);
            Assert.Equal(1, node.WarningCount);
        });
        Assert.Empty(review.Anchors);
    }

    [Fact]
    public async Task MissingParent_ReportsLocallyAndPrefersSourceFixForAnIsolatedTypo()
    {
        await using var fixture = await Fixture.CreateAsync();
        var review = (await fixture.IntakeAsync("""
            Business Code,Name,Type,Parent Business Code
            AST,Asteria,Organization,
            EU,Europe,Business Unit,AST
            EU-FIN,Finance,Department,EUX
            """)).Review!;

        var issue = Assert.Single(review.Issues, item => item.Code == OrganizationImportIssueCodes.MissingParent);
        var finance = review.Nodes.Single(node => node.Name == "Finance");
        Assert.Equal(finance.ProposalNodeId, issue.ProposalNodeId);
        Assert.Equal(OrganizationImportFields.ParentBusinessCode, issue.Field);
        Assert.Equal(OrganizationImportResolutionKind.CorrectSource, issue.PreferredResolution);
        Assert.Contains(OrganizationImportResolutionKind.ReturnToMatch, issue.AllowedResolutions);
        Assert.DoesNotContain(review.Issues, item => item.Code == OrganizationImportIssueCodes.MultipleRoots);
        Assert.Equal(OrganizationImportReviewState.Blocked, review.Readiness.State);
        Assert.False(review.Readiness.CanPublish);
    }

    [Fact]
    public async Task MissingParent_PrefersMatchWhenTheReferenceLivesInAnotherColumn()
    {
        await using var fixture = await Fixture.CreateAsync();
        var review = (await fixture.IntakeAsync("""
            Business Code,Name,Type,Parent Business Code,Region
            AST,Asteria,Organization,,EMEA
            EU,Europe,Business Unit,EMEA,EMEA
            """)).Review!;

        var issue = Assert.Single(review.Issues, item => item.Code == OrganizationImportIssueCodes.MissingParent);
        Assert.Equal(OrganizationImportResolutionKind.ReturnToMatch, issue.PreferredResolution);
        Assert.Contains(OrganizationImportResolutionKind.CorrectSource, issue.AllowedResolutions);
    }

    [Fact]
    public async Task DuplicateCodeAndSelfParent_AreBlockersWithRelatedNodes()
    {
        await using var fixture = await Fixture.CreateAsync();
        var review = (await fixture.IntakeAsync("""
            Business Code,Name,Type,Parent Business Code
            AST,Asteria,Organization,
            OPS,Operations,Department,AST
            OPS,Operations Europe,Department,AST
            LOOP,Loop,Team,LOOP
            """)).Review!;

        var duplicate = Assert.Single(review.Issues, item => item.Code == OrganizationImportIssueCodes.DuplicateBusinessCode);
        Assert.Null(duplicate.ProposalNodeId);
        Assert.Equal(2, duplicate.RelatedNodeIds.Count);
        Assert.Equal(OrganizationImportResolutionKind.CorrectSource, duplicate.PreferredResolution);
        var self = Assert.Single(review.Issues, item => item.Code == OrganizationImportIssueCodes.SelfParent);
        Assert.Equal(review.Nodes.Single(node => node.Name == "Loop").ProposalNodeId, self.ProposalNodeId);
        Assert.False(review.Readiness.CanPublish);
    }

    [Fact]
    public async Task MultipleRoots_AreResolvedOnlyByAddingAnOrganizationRoot()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoTops);
        var roots = Assert.Single(session.Review!.Issues);
        Assert.Equal(OrganizationImportIssueCodes.MultipleRoots, roots.Code);
        Assert.Equal(OrganizationImportResolutionKind.AddOrganizationRoot, roots.PreferredResolution);
        Assert.Equal(2, roots.RelatedNodeIds.Count);

        var resolved = await fixture.Imports.UpdateReviewResolutionsAsync(session.Id, session.Version,
            new UpdateOrganizationImportReviewResolutionsRequest(IntroducedRoot: new("Asteria", "AST")), Actor, CancellationToken.None);

        var review = resolved.Review!;
        Assert.Equal(OrganizationImportReviewState.Ready, review.Readiness.State);
        Assert.Equal(3, review.Summary.NewUnits);
        Assert.Equal(1, review.Summary.RootCount);
        Assert.Equal("Asteria", review.Nodes.Single(node => node.IsRoot).Name);
        Assert.Equal("Asteria", review.Resolutions.IntroducedRoot!.Name);
        Assert.NotEqual(session.Review.ProposalFingerprint, review.ProposalFingerprint);
    }

    [Fact]
    public async Task Resolutions_ThatAnswerNoIssue_AreRejected()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoFinances);
        var finance = session.Review!.Nodes.First(node => node.Name == "Finance").ProposalNodeId;

        await AssertInvalid(new(IntroducedRoot: new("Another", "ANOTHER")));
        await AssertInvalid(new(AcceptedExistingMatches: new Dictionary<string, Guid> { [finance] = Guid.NewGuid() }));
        await AssertInvalid(new(KeepExistingNodeIds: [finance]));

        async Task AssertInvalid(UpdateOrganizationImportReviewResolutionsRequest request)
        {
            var problem = await Assert.ThrowsAsync<OrganizationImportReviewException>(() =>
                fixture.Imports.UpdateReviewResolutionsAsync(session.Id, session.Version, request, Actor, CancellationToken.None));
            Assert.Equal("InvalidResolution", problem.Code);
        }
    }

    [Fact]
    public async Task SameNameExistingUnit_IsOnlyAWarning_UntilTheAdministratorExplicitlyChoosesIt()
    {
        await using var fixture = await Fixture.CreateAsync();
        var root = await fixture.Organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var sales = await fixture.Organization.CreateUnitAsync(new("SALES", "Sales", OrganizationalUnitTypeCatalog.TeamId, root.Id, EffectiveDate), CancellationToken.None);
        var session = await fixture.IntakeAsync("""
            Name,Type,Parent Business Code
            Sales,Team,ROOT
            """);

        var warning = Assert.Single(session.Review!.Issues);
        Assert.Equal(OrganizationImportIssueCodes.PossibleExistingUnit, warning.Code);
        Assert.Equal(OrganizationImportResolutionKind.ChooseExistingUnit, warning.PreferredResolution);
        Assert.True(session.Review.Readiness.CanPublish);
        var node = Assert.Single(session.Review.Nodes);
        Assert.Equal(OrganizationImportNodeClassification.Create, node.Classification);
        Assert.Equal(sales.Id, Assert.Single(node.Candidates).Id);
        Assert.Equal(root.Id, Assert.Single(session.Review.Anchors).Id);

        var chosen = await fixture.Imports.UpdateReviewResolutionsAsync(session.Id, session.Version,
            new(AcceptedExistingMatches: new Dictionary<string, Guid> { [node.ProposalNodeId] = sales.Id }), Actor, CancellationToken.None);

        var bound = Assert.Single(chosen.Review!.Nodes);
        Assert.Equal(OrganizationImportNodeClassification.Existing, bound.Classification);
        Assert.Equal(sales.Id, bound.ExistingOrgUnitId);
        Assert.Equal(0, chosen.Review.Readiness.CreateCount);
        Assert.Equal(1, chosen.Review.Readiness.ExistingCount);
    }

    [Fact]
    public async Task ExistingDifference_IsAConflictUntilKeptAsIs()
    {
        await using var fixture = await Fixture.CreateAsync();
        var root = await fixture.Organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var session = await fixture.IntakeAsync($"""
            Fusion OrgUnit ID,Business Code,Name,Type,Parent Business Code
            {root.Id},ROOT,Different name,Organization,
            """);

        var conflict = Assert.Single(session.Review!.Issues);
        Assert.Equal(OrganizationImportIssueCodes.ExistingDifference, conflict.Code);
        Assert.Equal(1, session.Review.Summary.ConflictUnits);

        var kept = await fixture.Imports.UpdateReviewResolutionsAsync(session.Id, session.Version,
            new(KeepExistingNodeIds: [conflict.ProposalNodeId!]), Actor, CancellationToken.None);

        Assert.Empty(kept.Review!.Issues);
        Assert.Equal(OrganizationImportNodeClassification.Existing, Assert.Single(kept.Review.Nodes).Classification);
    }

    [Fact]
    public async Task ChangingTheInterpretationInMatch_DropsReviewResolutions()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoTops);
        session = await fixture.Imports.UpdateReviewResolutionsAsync(session.Id, session.Version,
            new(IntroducedRoot: new("Asteria", "AST")), Actor, CancellationToken.None);
        Assert.NotNull(session.Review!.Resolutions.IntroducedRoot);

        var rematched = await fixture.Imports.UpdateMatchAsync(session.Id, session.Version,
            new UpdateOrganizationImportMatchRequest(TypeMappings: new Dictionary<string, Guid> { ["Division"] = OrganizationalUnitTypeCatalog.DepartmentId }),
            Actor, CancellationToken.None);

        Assert.Null(rematched.Review!.Resolutions.IntroducedRoot);
        Assert.Contains(rematched.Review.Issues, issue => issue.Code == OrganizationImportIssueCodes.MultipleRoots);
    }

    [Fact]
    public async Task ProposalFingerprint_IsStable_AndChangesWithEffectiveDate()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoFinances);
        var again = await fixture.Imports.GetAsync(session.Id, CancellationToken.None);
        Assert.Equal(session.Review!.ProposalFingerprint, again.Review!.ProposalFingerprint);

        var moved = await fixture.Imports.ChangeEffectiveDateAsync(session.Id, session.Version, EffectiveDate.AddDays(1), Actor, CancellationToken.None);

        Assert.NotEqual(session.Review.ProposalFingerprint, moved.Review!.ProposalFingerprint);
        Assert.Equal(EffectiveDate.AddDays(1), moved.Review.EffectiveDate);
    }

    [Fact]
    public async Task ReviewContainsCanonicalResultIssuesOnly_AndDoesNotExistBeforeMatchIsComplete()
    {
        await using var fixture = await Fixture.CreateAsync();
        var incomplete = await fixture.IntakeAsync("""
            Business Code,Name,Type,Parent Business Code
            AST,Asteria,Groupe,
            """);
        Assert.Null(incomplete.Review);
        Assert.False(incomplete.Match!.Readiness.CanContinue);

        foreach (var csv in new[] { TwoFinances, TwoTops })
            Assert.All((await fixture.IntakeAsync(csv)).Review!.Issues,
                issue => Assert.Contains(issue.Code, OrganizationImportIssueCatalog.Codes));
    }

    [Fact]
    public async Task ParentReferenceAndLevelColumns_ProduceTheSameCanonicalHierarchy()
    {
        await using var fixture = await Fixture.CreateAsync();
        var byParent = (await fixture.IntakeAsync("""
            Name,Type,Parent Business Code
            Asteria,Organization,
            East,Division,Asteria
            Sales,Department,East
            """)).Review!;
        var byLevel = (await fixture.IntakeAsync("""
            Organization,Division,Department
            Asteria,East,Sales
            """)).Review!;

        Assert.Equal(Shape(byParent), Shape(byLevel));

        static IReadOnlyList<string> Shape(OrganizationImportReviewDto review)
        {
            var byId = review.Nodes.ToDictionary(node => node.ProposalNodeId);
            string Path(OrganizationImportReviewNodeDto node)
                => node.ParentProposalNodeId is { } parent ? $"{Path(byId[parent])}/{node.Name}" : node.Name;
            return review.Nodes.Select(node => $"{Path(node)}|{node.TypeName}|{node.Classification}|{node.Depth}|{node.IsRoot}")
                .Order(StringComparer.Ordinal).ToList();
        }
    }

    [Fact]
    public async Task Publish_WritesTheReviewedProposal_RecordsTheFingerprint_AndReplaysIdempotently()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoFinances);
        var fingerprint = session.Review!.ProposalFingerprint;

        var first = await fixture.Imports.CommitAsync(session.Id, session.Version, fingerprint, Actor, CancellationToken.None);
        var replay = await fixture.Imports.CommitAsync(session.Id, session.Version, fingerprint, Actor, CancellationToken.None);

        Assert.Equal(5, first.CreatedUnits.Count);
        Assert.Equal(first.CreatedUnits.Select(unit => unit.OrgUnitId), replay.CreatedUnits.Select(unit => unit.OrgUnitId));
        Assert.Equal(5, await fixture.Context.OrgUnits.CountAsync());
        var stored = await fixture.Context.OrganizationImportSessions.SingleAsync(item => item.Id == session.Id);
        Assert.Equal(fingerprint, stored.FinalSemanticDigest);
        Assert.Equal(Actor.DisplayName, stored.CommittedByDisplayName);
        Assert.Equal(EffectiveDate, first.EffectiveDate);
    }

    [Fact]
    public async Task Publish_OfAChangedProposal_StopsBeforeAnyWrite()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoFinances);
        var reviewed = session.Review!.ProposalFingerprint;
        var moved = await fixture.Imports.ChangeEffectiveDateAsync(session.Id, session.Version, EffectiveDate.AddDays(3), Actor, CancellationToken.None);

        var problem = await Assert.ThrowsAsync<OrganizationImportReviewException>(() =>
            fixture.Imports.CommitAsync(session.Id, moved.Version, reviewed, Actor, CancellationToken.None));

        Assert.Equal("ProposalChanged", problem.Code);
        Assert.Equal(0, await fixture.Context.OrgUnits.CountAsync());
        Assert.Equal("Active", (await fixture.Imports.GetAsync(session.Id, CancellationToken.None)).Status);
    }

    [Fact]
    public async Task Publish_WithBlockers_IsRefused()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoTops);

        var problem = await Assert.ThrowsAsync<OrganizationImportReviewException>(() =>
            fixture.Imports.CommitAsync(session.Id, session.Version, session.Review!.ProposalFingerprint, Actor, CancellationToken.None));

        Assert.Equal("StructuralValidationFailed", problem.Code);
        Assert.Equal(0, await fixture.Context.OrgUnits.CountAsync());
    }

    [Fact]
    public async Task Resolutions_FromAStaleVersion_AreRejected()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoTops);
        await fixture.Imports.ChangeEffectiveDateAsync(session.Id, session.Version, EffectiveDate.AddDays(1), Actor, CancellationToken.None);

        await Assert.ThrowsAsync<ConcurrencyException>(() => fixture.Imports.UpdateReviewResolutionsAsync(session.Id, session.Version + 1,
            new(IntroducedRoot: new("Asteria", "AST")), Actor, CancellationToken.None));
    }

    [Fact]
    public async Task Proposals_AreInvisibleToAnotherTenant()
    {
        await using var fixture = await Fixture.CreateAsync();
        var session = await fixture.IntakeAsync(TwoFinances);
        var other = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var otherContext = TestDbContextFactory.Create(other, fixture.DatabaseName);
        var otherImports = Fixture.Service(otherContext, other);

        await Assert.ThrowsAsync<EntityNotFoundException>(() => otherImports.GetAsync(session.Id, CancellationToken.None));
    }

    private static readonly OrganizationImportActor Actor = new(Guid.NewGuid(), "Ada Admin");

    private sealed class Fixture : IAsyncDisposable
    {
        private Fixture(string databaseName, CoreHRDbContext context, TestTenantContext tenant)
        {
            DatabaseName = databaseName;
            Context = context;
            Organization = new OrganizationService(context, tenant);
            Imports = Service(context, tenant);
        }

        public string DatabaseName { get; }
        public CoreHRDbContext Context { get; }
        public OrganizationService Organization { get; }
        public OrganizationImportService Imports { get; }

        public static async Task<Fixture> CreateAsync()
        {
            var databaseName = Guid.NewGuid().ToString();
            var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
            var context = TestDbContextFactory.Create(tenant, databaseName);
            context.OrganizationalUnitTypes.AddRange(OrganizationalUnitTypeCatalog.BuiltIns.Select(type => OrganizationalUnitType.CreateBuiltIn(type.Id, type.Name)));
            await context.SaveChangesAsync();
            return new Fixture(databaseName, context, tenant);
        }

        public static OrganizationImportService Service(CoreHRDbContext context, TestTenantContext tenant)
        {
            var organization = new OrganizationService(context, tenant);
            return new OrganizationImportService(context, tenant,
                new OrganizationImportSourceInspectionService(new SafeTabularSourceReader()), organization,
                new OrganizationImportInterpreter(context, tenant));
        }

        public async Task<OrganizationImportSessionDto> IntakeAsync(string csv)
        {
            var intake = await Imports.IntakeAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "organization.csv", "text/csv",
                EffectiveDate, Guid.NewGuid(), null, Actor, CancellationToken.None);
            return intake.Session!;
        }

        public ValueTask DisposeAsync() => Context.DisposeAsync();
    }
}
