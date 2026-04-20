using System.Reflection;
using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftStructureWorkspace;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.DraftStructure;

public class DraftStructureResilienceTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private const string SettingsJson = """{"orgUnitTypes":["Department","Team"]}""";
    private const string TemplateHeaders = "Unit Code,Unit Name,Unit Type,Parent Unit Code,Location,Description\n";

    [Fact]
    public async Task GetDraftStructureWorkspace_WithMalformedAttributesJson_ReturnsEmptyAttributes()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var unit = DraftOrgUnit.Create(
                TenantId,
                "ENG",
                "Engineering",
                "department",
                null,
                null,
                "{\"costCenter\":\"100\"}",
                null);

            SetPrivateProperty(unit, nameof(DraftOrgUnit.AttributesJson), "{not valid json");

            seedContext.DraftOrgUnits.Add(unit);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetDraftStructureWorkspaceQueryHandler(context);

        var workspace = await handler.Handle(new GetDraftStructureWorkspaceQuery(), CancellationToken.None);

        var unitDto = Assert.Single(workspace.Units);
        Assert.Empty(unitDto.Attributes);
    }

    [Fact]
    public async Task GetSessionAsync_WithCorruptStoredPayload_ExpiresSessionAndThrowsFriendlyMessage()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = new DraftStructureImportWorkflowService(context, tenantContext);

        var upload = await service.UploadAsync(
            CreateCsvFile(
                "structure.csv",
                TemplateHeaders +
                "ENG,Engineering,Department,,,\n"),
            CancellationToken.None);

        var session = await context.DraftStructureImportSessions.FirstAsync(candidate => candidate.Id == upload.Id);
        SetPrivateProperty(session, nameof(DraftStructureImportSession.SourceRowsJson), "{not valid json");
        await context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.GetSessionAsync(upload.Id, CancellationToken.None));

        Assert.Contains("Upload the file again", ex.Message);

        var persistedSession = await context.DraftStructureImportSessions
            .AsNoTracking()
            .FirstAsync(candidate => candidate.Id == upload.Id);

        Assert.Equal(DraftStructureImportStage.Expired, persistedSession.Stage);
    }

    private static IFormFile CreateCsvFile(string fileName, string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        var stream = new MemoryStream(bytes);

        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/csv"
        };
    }

    private static void SetPrivateProperty<TTarget, TValue>(TTarget target, string propertyName, TValue value)
    {
        var property = typeof(TTarget).GetProperty(
            propertyName,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);

        Assert.NotNull(property);

        var setter = property!.SetMethod ?? property.GetSetMethod(nonPublic: true);
        Assert.NotNull(setter);

        setter!.Invoke(target, [value]);
    }
}