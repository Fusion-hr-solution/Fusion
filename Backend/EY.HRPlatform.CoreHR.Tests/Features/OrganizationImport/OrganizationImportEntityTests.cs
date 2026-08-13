using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportEntityTests
{
    [Fact]
    public void EfModel_LocksTenantFiltersRelationshipConcurrencyAndPayloadBoundary()
    {
        var tenantId = Guid.NewGuid();
        using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var session = context.Model.FindEntityType(typeof(OrganizationImportSession))!;
        var source = context.Model.FindEntityType(typeof(OrganizationImportSource))!;

        Assert.NotEmpty(session.GetDeclaredQueryFilters());
        Assert.NotEmpty(source.GetDeclaredQueryFilters());
        Assert.True(session.FindProperty(nameof(OrganizationImportSession.Version))!.IsConcurrencyToken);
        Assert.Equal(64, session.FindProperty(nameof(OrganizationImportSession.CreationFingerprint))!.GetMaxLength());
        Assert.Contains(session.GetIndexes(), index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual([nameof(OrganizationImportSession.TenantId), nameof(OrganizationImportSession.CreationToken)]));
        Assert.True(source.GetIndexes().Single(index =>
            index.Properties.Select(property => property.Name).SequenceEqual([nameof(OrganizationImportSource.SessionId)])).IsUnique);
        Assert.Equal("bytea", source.FindProperty(nameof(OrganizationImportSource.RawBytes))!
            .FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Equal("jsonb", source.FindProperty(nameof(OrganizationImportSource.SourceTableJson))!
            .FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Null(session.FindProperty("RootBaseline"));
        Assert.Null(session.FindProperty("Readiness"));
    }

    [Fact]
    public async Task TenantInterceptor_RejectsAtomicSessionSourceCreationForAnotherTenant()
    {
        var currentTenant = Guid.NewGuid();
        var otherTenant = Guid.NewGuid();
        await using var context = TestDbContextFactory.CreateWithInterceptor(TestTenantContext.WithTenant(currentTenant));
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Admin");
        var session = OrganizationImportSession.Create(
            otherTenant, new DateOnly(2026, 8, 12), Guid.NewGuid(), new string('b', 64), actor);
        session.AttachSource(OrganizationImportSource.Create(
            otherTenant,
            session.Id,
            new InspectedOrganizationSource(
                "organization.csv", "csv", "text/csv", new string('a', 64), "CSV", "A1:A2",
                new OrganizationSourceTable([new OrganizationSourceColumn(0, "Name")], [new string?[] { "Root" }]),
                [1])));
        context.OrganizationImportSessions.Add(session);

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => context.SaveChangesAsync());
        Assert.Equal(2, context.ChangeTracker.Entries().Count(entry => entry.State == EntityState.Added));
    }

    [Fact]
    public void Discard_PurgesPayloadAndRetainsNormalizedProvenance()
    {
        var tenantId = Guid.NewGuid();
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Ada Admin");
        var table = new OrganizationSourceTable(
            [new OrganizationSourceColumn(0, "Name")],
            [new string?[] { "Operations" }]);
        var inspected = new InspectedOrganizationSource(
            "organization.csv", "csv", "text/csv", new string('a', 64), "CSV", "A1:A2", table, [1, 2, 3]);
        var session = OrganizationImportSession.Create(
            tenantId, new DateOnly(2026, 8, 12), Guid.NewGuid(), new string('b', 64), actor);
        var source = OrganizationImportSource.Create(tenantId, session.Id, inspected);
        session.AttachSource(source);

        Assert.True(session.Discard(actor));
        Assert.False(session.Discard(actor));
        Assert.Equal(OrganizationImportStatus.Discarded, session.Status);
        Assert.Null(source.RawBytes);
        Assert.Null(source.SourceTableJson);
        Assert.NotNull(source.PayloadPurgedAt);
        Assert.Equal("organization.csv", source.OriginalFileName);
        Assert.Equal("A1:A2", source.SelectedRange);
        Assert.Equal(1, source.RowCount);
    }

    [Fact]
    public void DiscardedSession_CannotReturnToActiveOrChangeDate()
    {
        var actor = new OrganizationImportActor(Guid.NewGuid(), "Admin");
        var tenantId = Guid.NewGuid();
        var session = OrganizationImportSession.Create(
            tenantId, new DateOnly(2026, 8, 12), Guid.NewGuid(), new string('b', 64), actor);
        session.AttachSource(OrganizationImportSource.Create(
            tenantId,
            session.Id,
            new InspectedOrganizationSource(
                "organization.csv", "csv", "text/csv", new string('a', 64), "CSV", "A1:A2",
                new OrganizationSourceTable([new OrganizationSourceColumn(0, "Name")], [new string?[] { "Root" }]),
                [1])));
        session.Discard(actor);

        Assert.Throws<InvalidOperationException>(() => session.ChangeEffectiveDate(new DateOnly(2026, 9, 1), actor));
    }
}
