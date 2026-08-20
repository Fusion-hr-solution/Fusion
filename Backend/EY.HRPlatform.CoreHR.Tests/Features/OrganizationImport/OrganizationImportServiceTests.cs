using System.Text;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportServiceTests
{
    [Fact]
    public async Task Intake_ReplayReturnsOneSessionAndPreservesFirstDate()
    {
        var tenantId = Guid.NewGuid();
        var token = Guid.NewGuid();
        var dbName = Guid.NewGuid().ToString();
        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId), dbName);
        var service = CreateService(context, TestTenantContext.WithTenant(tenantId));
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Admin One");

        var first = await service.IntakeAsync(
            Csv("Name\nRoot"), "organization.csv", "text/csv", new DateOnly(2026, 8, 12), token, null, actor, CancellationToken.None);
        var replay = await service.IntakeAsync(
            Csv("Name\nRoot"), "organization.csv", "text/csv", new DateOnly(2026, 9, 1), token, null, actor, CancellationToken.None);

        Assert.False(first.Replayed);
        Assert.True(replay.Replayed);
        Assert.Equal(first.Session!.Id, replay.Session!.Id);
        Assert.Equal(new DateOnly(2026, 8, 12), replay.Session.EffectiveDate);
        Assert.Single(context.OrganizationImportSessions);
        Assert.Single(context.OrganizationImportSources);
    }

    [Fact]
    public async Task Intake_ReusedTokenWithDifferentSourceConflicts()
    {
        var tenantId = Guid.NewGuid();
        var token = Guid.NewGuid();
        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = CreateService(context, TestTenantContext.WithTenant(tenantId));
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Admin");
        await service.IntakeAsync(Csv("Name\nRoot"), "one.csv", null, new DateOnly(2026, 8, 12), token, null, actor, CancellationToken.None);

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => service.IntakeAsync(
            Csv("Name\nDifferent"), "two.csv", null, new DateOnly(2026, 8, 12), token, null, actor, CancellationToken.None));

        Assert.Equal("IdempotencyConflict", exception.Code);
        Assert.Single(context.OrganizationImportSessions);
    }

    [Fact]
    public async Task ActiveListSupportsMultipleSessionsAndDiscardPurgesPayload()
    {
        var tenantId = Guid.NewGuid();
        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = CreateService(context, TestTenantContext.WithTenant(tenantId));
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Admin");
        var first = await service.IntakeAsync(Csv("Name\nRoot"), "one.csv", null, new DateOnly(2026, 8, 12), Guid.NewGuid(), null, actor, CancellationToken.None);
        await service.IntakeAsync(Csv("Name\nOther"), "two.csv", null, new DateOnly(2026, 8, 13), Guid.NewGuid(), null, actor, CancellationToken.None);

        Assert.Equal(2, (await service.GetActiveAsync(CancellationToken.None)).Count);
        var discarded = await service.DiscardAsync(first.Session!.Id, first.Session.Version, actor, CancellationToken.None);

        Assert.Equal("Discarded", discarded.Status);
        Assert.Null(discarded.Source.Table);
        Assert.NotNull(discarded.Source.PayloadPurgedAt);
        Assert.Single(await service.GetActiveAsync(CancellationToken.None));
        Assert.Equal("one.csv", discarded.Source.OriginalFileName);
    }

    [Fact]
    public async Task TenantFilterDoesNotRevealOtherTenantSession()
    {
        var firstTenant = Guid.NewGuid();
        var secondTenant = Guid.NewGuid();
        var dbName = Guid.NewGuid().ToString();
        Guid sessionId;
        await using (var firstContext = TestDbContextFactory.Create(TestTenantContext.WithTenant(firstTenant), dbName))
        {
            var service = CreateService(firstContext, TestTenantContext.WithTenant(firstTenant));
            var result = await service.IntakeAsync(
                Csv("Name\nRoot"), "one.csv", null, new DateOnly(2026, 8, 12), Guid.NewGuid(), null,
                new OrganizationImportActor(Guid.NewGuid(), "Admin"), CancellationToken.None);
            sessionId = result.Session!.Id;
        }
        await using var secondContext = TestDbContextFactory.Create(TestTenantContext.WithTenant(secondTenant), dbName);
        var secondService = CreateService(secondContext, TestTenantContext.WithTenant(secondTenant));

        await Assert.ThrowsAsync<EY.HRPlatform.CoreHR.Exceptions.EntityNotFoundException>(() =>
            secondService.GetAsync(sessionId, CancellationToken.None));
    }

    [Fact]
    public async Task DateChange_PreservesSourceAndRefreshesTheTwoCanonicalRootFactsWithoutMutation()
    {
        var tenantId = Guid.NewGuid();
        var firstDate = new DateOnly(2026, 8, 12);
        var futureDate = new DateOnly(2026, 10, 1);
        var tenantContext = TestTenantContext.WithTenant(tenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var organization = new Mock<IOrganizationService>();
        organization.Setup(service => service.GetReadinessAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationReadinessDto(true, null, true, Guid.NewGuid(), firstDate, true));
        organization.Setup(service => service.GetHierarchyAsync(firstDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationHierarchyDto(firstDate, []));
        organization.Setup(service => service.GetHierarchyAsync(futureDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationHierarchyDto(futureDate,
                [new OrganizationHierarchyNodeDto(State(Guid.NewGuid(), "ROOT", "Asteria", futureDate), [])]));
        var service = new OrganizationImportService(
            context,
            TestTenantContext.WithTenant(tenantId),
            new OrganizationImportSourceInspectionService(new SafeTabularSourceReader()),
            organization.Object,
            new OrganizationImportInterpreter(context, tenantContext));
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Admin");

        var created = await service.IntakeAsync(
            Csv("Name\nRoot"), "organization.csv", null, firstDate, Guid.NewGuid(), null, actor, CancellationToken.None);
        var originalHash = created.Session!.Source.Sha256;
        var originalTable = created.Session.Source.Table;
        Assert.True(created.Session.Baseline.HasPermanentRootIdentity);
        Assert.False(created.Session.Baseline.HasRootAsOfEffectiveDate);

        var updated = await service.ChangeEffectiveDateAsync(
            created.Session.Id, created.Session.Version, futureDate, actor, CancellationToken.None);

        Assert.Equal(futureDate, updated.EffectiveDate);
        Assert.Equal(originalHash, updated.Source.Sha256);
        Assert.Equal(originalTable!.Columns, updated.Source.Table!.Columns);
        Assert.Equal(originalTable.Rows, updated.Source.Table.Rows);
        Assert.True(updated.Baseline.HasPermanentRootIdentity);
        Assert.True(updated.Baseline.HasRootAsOfEffectiveDate);
        VerifyNoCanonicalMutation(organization);
    }

    private static OrganizationImportService CreateService(
        EY.HRPlatform.CoreHR.Infrastructure.Persistence.CoreHRDbContext context,
        TestTenantContext tenantContext)
    {
        var organization = new Mock<IOrganizationService>();
        organization.Setup(service => service.GetReadinessAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationReadinessDto(false, null, false, null, null, false));
        organization.Setup(service => service.GetHierarchyAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .Returns<DateOnly, CancellationToken>((date, _) => Task.FromResult(new OrganizationHierarchyDto(date, [])));
        return new OrganizationImportService(
            context,
            tenantContext,
            new OrganizationImportSourceInspectionService(new SafeTabularSourceReader()),
            organization.Object,
            new OrganizationImportInterpreter(context, tenantContext));
    }

    private static MemoryStream Csv(string value) => new(Encoding.UTF8.GetBytes(value));

    private static OrganizationUnitStateDto State(Guid id, string code, string name, DateOnly date)
        => new(id, code, name, Guid.NewGuid(), "Organization", null, null, name,
            EY.HRPlatform.CoreHR.Domain.Entities.OrgUnitLifecycleState.Active, date, 1);

    private static void VerifyNoCanonicalMutation(Mock<IOrganizationService> organization)
    {
        organization.Verify(service => service.CreateRootAsync(It.IsAny<CreateOrganizationRootRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.CreateUnitAsync(It.IsAny<CreateOrganizationUnitRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.ChangeAsync(It.IsAny<Guid>(), It.IsAny<uint>(), It.IsAny<ChangeOrganizationUnitRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.MoveAsync(It.IsAny<Guid>(), It.IsAny<uint>(), It.IsAny<MoveOrganizationUnitRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.InactivateAsync(It.IsAny<Guid>(), It.IsAny<uint>(), It.IsAny<InactivateOrganizationUnitRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.CorrectAsync(It.IsAny<Guid>(), It.IsAny<uint>(), It.IsAny<CorrectOrganizationUnitRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.CorrectCodeAsync(It.IsAny<Guid>(), It.IsAny<uint>(), It.IsAny<CorrectOrganizationCodeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.CancelChangeAsync(It.IsAny<Guid>(), It.IsAny<uint>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.CreateTypeAsync(It.IsAny<CreateOrganizationalUnitTypeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.RenameTypeAsync(It.IsAny<Guid>(), It.IsAny<RenameOrganizationalUnitTypeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        organization.Verify(service => service.DeleteTypeAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
