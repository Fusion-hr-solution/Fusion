using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportInterpretationAndCommitTests
{
    private static readonly DateOnly EffectiveDate = new(2026, 8, 14);

    [Fact]
    public async Task LevelColumns_ReusesExactPrefixes_SeparatesSameNamesAcrossBranches_AndRequiresExplicitRoot()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var table = new OrganizationSourceTable(
            [new(0, "Division"), new(1, "Department"), new(2, "Team")],
            [
                new string?[] { "East", "Sales", "Alpha" },
                new string?[] { "East", "Sales", "Beta" },
                new string?[] { "West", "Sales", "Gamma" },
            ]);
        var session = Session(tenant.TenantId, table);
        session.ReplaceDecisions(new OrganizationImportDecisions(
            Shape: OrganizationImportShape.LevelColumns,
            IntroducedRoot: new OrganizationImportRootDecision("Asteria", "ASTERIA")), Actor());

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.Equal(8, review.ProposalNodes.Count);
        Assert.Equal(2, review.ProposalNodes.Count(node => node.Name == "Sales"));
        Assert.All(review.ProposalNodes, node => Assert.Equal(OrganizationImportNodeClassification.Create, node.Classification));
        Assert.Contains(review.ProposalNodes, node => node.IsProposalRoot && node.Name == "Asteria");
        Assert.Contains(review.Issues, issue => issue.Code == "DuplicateProposalCode");
    }

    [Fact]
    public async Task SingleParentlessRow_AutoResolvesAsRoot_WithoutRequiringAnIntroducedRoot()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        // Asteria-style source: exactly one parentless row, everything else connected beneath it.
        // The top's source type is unfamiliar vocabulary ("Groupe") mapped to a non-Organization
        // type, yet its structural root-ness must be inferred deterministically with no root issue.
        var table = new OrganizationSourceTable(
            [new(0, "Business Code"), new(1, "Name"), new(2, "Type"), new(3, "Parent Business Code")],
            [
                new string?[] { "AST", "Asteria Technologies", "Groupe", null },
                new string?[] { "SALES", "Sales", "Team", "AST" },
                new string?[] { "ENG", "Engineering", "Team", "AST" },
            ]);
        var session = Session(tenant.TenantId, table);
        session.ReplaceDecisions(new OrganizationImportDecisions(
            TypeMappings: new Dictionary<string, Guid> { ["Groupe"] = OrganizationalUnitTypeCatalog.BusinessUnitId }), Actor());

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        var root = Assert.Single(review.ProposalNodes, node => node.IsProposalRoot);
        Assert.Equal("Asteria Technologies", root.Name);
        Assert.Null(root.ParentNodeId);
        Assert.DoesNotContain(review.Issues, issue => issue.Code is "FreshRootRequired" or "RootCount" or "RootType");
        Assert.True(review.CanCommit);
    }

    [Fact]
    public async Task ValidSourceIdentity_CannotBeDismissedByClearingItsCorrectFieldMapping()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var organization = new OrganizationService(context, tenant);
        var root = await organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var table = NativeTable([root.Id.ToString(), null, "Asteria", "Organization", null]);
        var session = Session(tenant.TenantId, table);
        session.ReplaceDecisions(new OrganizationImportDecisions(
            FieldMappings: new Dictionary<string, int?> { [OrganizationImportFields.FusionOrgUnitId] = null }), Actor());

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        var node = Assert.Single(review.ProposalNodes);
        Assert.Equal(root.Id, node.CanonicalId);
        Assert.Equal(OrganizationImportNodeClassification.Unchanged, node.Classification);
        Assert.Contains(review.Issues, issue => issue.Code == "AuthoritativeIdentityRetained");
    }

    [Fact]
    public async Task GeneratedCodeCollision_RemainsCreateAndNeverBecomesIdentityEvidence()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var organization = new OrganizationService(context, tenant);
        var root = await organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        await organization.CreateUnitAsync(new("SALES", "Legacy Sales", OrganizationalUnitTypeCatalog.TeamId, root.Id, EffectiveDate), CancellationToken.None);
        var session = Session(tenant.TenantId, NativeTable([null, null, "Sales", "Team", "ROOT"]));

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        var node = Assert.Single(review.ProposalNodes);
        Assert.True(node.BusinessCodeGenerated);
        Assert.Equal("SALES", node.BusinessCode);
        Assert.Equal(OrganizationImportNodeClassification.Create, node.Classification);
        Assert.Null(node.CanonicalId);
        Assert.Contains(review.Issues, issue => issue.Code == "BusinessCodeUnavailable");
    }

    [Fact]
    public async Task UnsupportedExistingDifference_IsConflictAndNeverUpdateOrCreate()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var organization = new OrganizationService(context, tenant);
        var root = await organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var session = Session(tenant.TenantId, NativeTable([root.Id.ToString(), "ROOT", "Different name", "Organization", null]));

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.Equal(OrganizationImportNodeClassification.Conflict, Assert.Single(review.ProposalNodes).Classification);
        Assert.Contains(review.Issues, issue => issue.Code == "UnsupportedExistingDifference" && issue.Severity == OrganizationImportIssueSeverity.Blocker);
        Assert.Equal(0, review.CreateCount);
    }

    [Fact]
    public async Task Commit_CreatesParentedUnitThroughCanonicalHistory_ThenReplaysWithoutDuplicates()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var organization = new OrganizationService(context, tenant);
        await organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var interpreter = new OrganizationImportInterpreter(context, tenant);
        var imports = new OrganizationImportService(context, tenant, new OrganizationImportSourceInspectionService(new SafeTabularSourceReader()), organization, interpreter);
        var actor = Actor();
        var csv = "Fusion OrgUnit ID,Business Code,Name,Type,Parent Business Code\n,TEAMX,Team X,Team,ROOT";
        var intake = await imports.IntakeAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "organization.csv", "text/csv",
            EffectiveDate, Guid.NewGuid(), null, actor, CancellationToken.None);
        var active = intake.Session!;
        Assert.True(active.Review!.CanCommit);

        var first = await imports.CommitAsync(active.Id, active.Version, active.Review.SemanticDigest, actor, CancellationToken.None);
        var replay = await imports.CommitAsync(active.Id, active.Version, active.Review.SemanticDigest, actor, CancellationToken.None);

        Assert.False(first.NoChanges);
        Assert.Equal(first.SessionId, replay.SessionId);
        Assert.Equal(first.EffectiveDate, replay.EffectiveDate);
        Assert.Equal(first.CreatedUnits.Select(unit => unit.OrgUnitId), replay.CreatedUnits.Select(unit => unit.OrgUnitId));
        Assert.Single(first.CreatedUnits);
        Assert.Equal(2, await context.OrgUnits.CountAsync());
        Assert.Equal(2, await context.OrganizationChanges.CountAsync());
        Assert.Equal(2, await context.OrgUnitCodeReservations.CountAsync());
        var committed = await imports.GetAsync(active.Id, CancellationToken.None);
        Assert.Equal("Committed", committed.Status);
        Assert.Null(committed.Source.Table);
        Assert.NotNull(committed.Source.PayloadPurgedAt);
        Assert.Single(committed.FinalProvenance!);
    }

    [Fact]
    public async Task UnchangedNativeSource_CompletesAsNoOpWithoutOrganizationHistory()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var organization = new OrganizationService(context, tenant);
        var root = await organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var interpreter = new OrganizationImportInterpreter(context, tenant);
        var imports = new OrganizationImportService(context, tenant, new OrganizationImportSourceInspectionService(new SafeTabularSourceReader()), organization, interpreter);
        var csv = $"Fusion OrgUnit ID,Business Code,Name,Type,Parent Business Code\n{root.Id},ROOT,Asteria,Organization,";
        var intake = await imports.IntakeAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "organization.csv", "text/csv",
            EffectiveDate, Guid.NewGuid(), null, Actor(), CancellationToken.None);
        var before = await context.OrganizationChanges.CountAsync();

        var result = await imports.CommitAsync(intake.Session!.Id, intake.Session.Version, intake.Session.Review!.SemanticDigest, Actor(), CancellationToken.None);

        Assert.True(result.NoChanges);
        Assert.Empty(result.CreatedUnits);
        Assert.Equal(before, await context.OrganizationChanges.CountAsync());
    }

    [Fact]
    public async Task AdditiveNativeSource_CanCreateChildUnderMatchedParentFromSameSource()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        var organization = new OrganizationService(context, tenant);
        var root = await organization.CreateRootAsync(new("ROOT", "Asteria", EffectiveDate), CancellationToken.None);
        var csv = $"Fusion OrgUnit ID,Business Code,Name,Type,Parent Business Code\n{root.Id},ROOT,Asteria,Organization,\n,TEAMX,Team X,Team,ROOT";
        var inspected = await new OrganizationImportSourceInspectionService(new SafeTabularSourceReader())
            .InspectAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "organization.csv", "text/csv", null, CancellationToken.None);
        var session = Session(tenant.TenantId, Assert.IsType<OrganizationSourceReady>(inspected).Source.Table);

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.True(review.CanCommit);
        var created = Assert.Single(review.ProposalNodes, node => node.Classification == OrganizationImportNodeClassification.Create);
        Assert.Null(created.ParentNodeId);
        Assert.Equal(root.Id, created.ParentCanonicalId);
        Assert.DoesNotContain(review.Issues, issue => issue.Code == "ParentUnavailable");
    }

    private static OrganizationImportSession Session(Guid tenantId, OrganizationSourceTable table)
    {
        var actor = Actor();
        var session = OrganizationImportSession.Create(tenantId, EffectiveDate, Guid.NewGuid(), new string('a', 64), actor);
        session.AttachSource(OrganizationImportSource.Create(tenantId, session.Id,
            new InspectedOrganizationSource("source.csv", "csv", "text/csv", new string('b', 64), "CSV", "A1:Z99", table, [1, 2, 3])));
        return session;
    }

    private static OrganizationSourceTable NativeTable(IReadOnlyList<string?> row) => new(
        [new(0, "Fusion OrgUnit ID"), new(1, "Business Code"), new(2, "Name"), new(3, "Type"), new(4, "Parent Business Code")],
        [row]);

    private static OrganizationImportActor Actor() => new(Guid.NewGuid(), "Ada Admin");

    private static async Task SeedTypesAsync(EY.HRPlatform.CoreHR.Infrastructure.Persistence.CoreHRDbContext context)
    {
        context.OrganizationalUnitTypes.AddRange(OrganizationalUnitTypeCatalog.BuiltIns.Select(type => OrganizationalUnitType.CreateBuiltIn(type.Id, type.Name)));
        await context.SaveChangesAsync();
    }
}
