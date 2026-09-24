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
    public async Task LumeraHeaders_MapDeterministically_AndLeaveCountryFootprintOutOfTheStructure()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        var table = new OrganizationSourceTable(
            [new(0, "Org Key"), new(1, "Structure Label"), new(2, "Upstream Ref"), new(3, "Layer Label"), new(4, "Country Footprint")],
            [
                new string?[] { "ROOT", "Lumera", null, "Organization", "FR" },
                new string?[] { "ENG", "Engineering", "ROOT", "Division", "FR, DE" },
            ]);
        var session = Session(tenant.TenantId, table);

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.Equal(OrganizationImportShape.ParentReference, review.Shape);
        Assert.Equal(0, review.FieldMappings.Single(mapping => mapping.Field == OrganizationImportFields.BusinessCode).ColumnIndex);
        Assert.Equal(1, review.FieldMappings.Single(mapping => mapping.Field == OrganizationImportFields.Name).ColumnIndex);
        Assert.Equal(2, review.FieldMappings.Single(mapping => mapping.Field == OrganizationImportFields.ParentBusinessCode).ColumnIndex);
        Assert.Equal(3, review.FieldMappings.Single(mapping => mapping.Field == OrganizationImportFields.Type).ColumnIndex);
        Assert.DoesNotContain(review.FieldMappings, mapping => mapping.ColumnIndex == 4);
        Assert.NotNull(review.MappingPlan);
        Assert.Contains(review.MappingPlan.IgnoredColumns, column => column.ColumnIndex == 4);
        Assert.NotNull(review.CanonicalDraft);
        Assert.Equal(review.CanonicalDraft.Fingerprint, review.Validation!.DraftFingerprint);
    }

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
        var levels = new OrganizationImportDecisions(Shape: OrganizationImportShape.LevelColumns);
        session.ReplaceDecisions(levels, Actor());
        session.ReplaceDecisions(levels with { IntroducedRoot = new OrganizationImportRootDecision("Asteria", "ASTERIA") }, Actor());

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.Equal(8, review.ProposalNodes.Count);
        Assert.Equal(2, review.ProposalNodes.Count(node => node.Name == "Sales"));
        Assert.All(review.ProposalNodes, node => Assert.Equal(OrganizationImportNodeClassification.Create, node.Classification));
        Assert.Contains(review.ProposalNodes, node => node.IsProposalRoot && node.Name == "Asteria");
        Assert.DoesNotContain(Issues(review), issue => issue.Code == OrganizationImportIssueCodes.DuplicateBusinessCode);
        Assert.True(review.CanPublish);
        Assert.Equal(review.ProposalNodes.Count, review.ProposalNodes.Select(node => node.BusinessCode).Distinct(StringComparer.Ordinal).Count());
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
        Assert.DoesNotContain(Issues(review), issue => issue.Code == OrganizationImportIssueCodes.MultipleRoots);
        Assert.True(review.CanPublish);
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
        Assert.Equal(OrganizationImportNodeClassification.Existing, node.Classification);
        Assert.DoesNotContain(Issues(review), issue => issue.Severity == OrganizationImportIssueSeverity.Blocker);
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
        Assert.Equal("SALES-2", node.BusinessCode);
        Assert.Equal(OrganizationImportNodeClassification.Create, node.Classification);
        Assert.Null(node.CanonicalId);
        Assert.DoesNotContain(Issues(review), issue => issue.Code == OrganizationImportIssueCodes.BusinessCodeTaken);
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
        var difference = Assert.Single(Issues(review), issue => issue.Code == OrganizationImportIssueCodes.ExistingDifference);
        Assert.Equal(OrganizationImportIssueSeverity.Blocker, difference.Severity);
        Assert.Equal(OrganizationImportResolutionKind.KeepExisting, difference.PreferredResolution);
        Assert.DoesNotContain(review.ProposalNodes, node => node.Classification == OrganizationImportNodeClassification.Create);
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
        Assert.True(active.Review!.Readiness.CanPublish);

        var first = await imports.CommitAsync(active.Id, active.Version, active.Review.ProposalFingerprint, actor, CancellationToken.None);
        var replay = await imports.CommitAsync(active.Id, active.Version, active.Review.ProposalFingerprint, actor, CancellationToken.None);

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

        var result = await imports.CommitAsync(intake.Session!.Id, intake.Session.Version, intake.Session.Review!.ProposalFingerprint, Actor(), CancellationToken.None);

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

        Assert.True(review.CanPublish);
        var created = Assert.Single(review.ProposalNodes, node => node.Classification == OrganizationImportNodeClassification.Create);
        Assert.Null(created.ParentNodeId);
        Assert.Equal(root.Id, created.ParentCanonicalId);
        Assert.DoesNotContain(Issues(review), issue => issue.Code == OrganizationImportIssueCodes.ExistingUnavailableAsOfDate);
    }

    [Fact]
    public async Task LevelColumns_WithLeadingIndexColumn_IgnoresIt_ResolvesShape_AndBuildsOneRoot()
    {
        var tenant = TestTenantContext.WithTenant(Guid.NewGuid());
        await using var context = TestDbContextFactory.Create(tenant);
        await SeedTypesAsync(context);
        // The showcase file, re-exported with a leading "index" column (0..8). The index must never
        // become the top of the organization: shape resolves without AI, the index is set aside and
        // reported, and the single "Asteria Group" entity is the one structural root.
        var table = new OrganizationSourceTable(
            [new(0, "index"), new(1, "Entity"), new(2, "Strategic Pillar"), new(3, "Capability"), new(4, "Delivery Pod")],
            [
                new string?[] { "0", "Asteria Group", "Customer Growth", "Customer Experience", "Journey Design Pod" },
                new string?[] { "1", "Asteria Group", "Customer Growth", "Revenue Operations", "North Market Pod" },
                new string?[] { "2", "Asteria Group", "Customer Growth", "Revenue Operations", "South Market Pod" },
                new string?[] { "3", "Asteria Group", "Digital Foundations", "Data Products", "Governance Pod" },
                new string?[] { "4", "Asteria Group", "Digital Foundations", "Data Products", "Insights Pod" },
                new string?[] { "5", "Asteria Group", "Operational Excellence", "People Operations", "Talent Pod" },
            ]);
        var session = Session(tenant.TenantId, table);

        var review = await new OrganizationImportInterpreter(context, tenant).InterpretAsync(session, CancellationToken.None);

        Assert.Equal(OrganizationImportShape.LevelColumns, review.Shape);
        Assert.Equal(OrganizationImportResolutionStatus.Resolved, review.ShapeStatus);
        var ignored = Assert.Single(review.IgnoredColumns);
        Assert.Equal(0, ignored.ColumnIndex);
        Assert.Equal("index", ignored.Label);
        // No node is named after a row number, and "Asteria Group" is the one root.
        Assert.DoesNotContain(review.ProposalNodes, node => node.Name is "0" or "1" or "2" or "3" or "4" or "5");
        var root = Assert.Single(review.ProposalNodes, node => node.IsProposalRoot);
        Assert.Equal("Asteria Group", root.Name);
        Assert.DoesNotContain(Issues(review), issue => issue.Code == OrganizationImportIssueCodes.MultipleRoots);
    }

    private static IReadOnlyList<OrganizationImportIssue> Issues(OrganizationImportInterpretation review)
        => review.Validation?.Issues ?? throw new Xunit.Sdk.XunitException("Expected a complete Match with a validated draft.");

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
