using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.DraftStructure;

public class DraftStructureImportWorkflowTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private const string SettingsJson = """{"orgUnitTypes":["Department","Team"]}""";
    private const string TemplateHeaders = "Unit Code,Unit Name,Unit Type,Parent Unit Code,Business Code,Description\n";

    [Fact]
    public async Task ImportWorkflow_WithTemplateUpload_ReplacesDraftStructureAtomically()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            seedContext.DraftOrgUnits.Add(
                DraftOrgUnit.Create(
                    TenantId,
                    "OLD",
                    "Legacy Root",
                    "department",
                    null,
                    null,
                    null,
                    null));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = new DraftStructureImportWorkflowService(context, tenantContext);

        var upload = await service.UploadAsync(
            CreateCsvFile(
                "structure.csv",
                TemplateHeaders +
                "ENG,Engineering,Department,,ENG,\n" +
                "PLAT,Platform Team,Team,ENG,PLAT,\n"),
            CancellationToken.None);

        Assert.True(upload.CanValidate);

        var validated = await service.ValidateAsync(upload.Id, CancellationToken.None);
        Assert.Equal(0, validated.ValidationSummary.ErrorCount);
        Assert.True(validated.CanApply);

        var applied = await service.ApplyAsync(upload.Id, CancellationToken.None);
        Assert.Equal(2, applied.ReplacedUnitCount);

        var units = await context.DraftOrgUnits
            .OrderBy(unit => unit.ReferenceKey)
            .ToListAsync();

        Assert.Equal(2, units.Count);
        Assert.DoesNotContain(units, unit => unit.ReferenceKey == "OLD");

        var engineering = Assert.Single(units.Where(unit => unit.ReferenceKey == "ENG"));
        var platform = Assert.Single(units.Where(unit => unit.ReferenceKey == "PLAT"));
        Assert.Null(engineering.ParentId);
        Assert.Equal(engineering.Id, platform.ParentId);
    }

    [Fact]
    public async Task ImportWorkflow_WithNewKind_AutoPersistsExpandedSchema()
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
                "division.csv",
                TemplateHeaders +
                "HQ,Head Office,Division,,,\n"),
            CancellationToken.None);

        Assert.Contains(
            upload.KindResolutions,
            resolution => resolution.SourceValue == "Division"
                && resolution.CreateNewKind
                && resolution.IsResolved
                && resolution.ResolvedOrgUnitKindKey == "division");

        var validated = await service.ValidateAsync(upload.Id, CancellationToken.None);
        Assert.Equal(0, validated.ValidationSummary.ErrorCount);

        var applied = await service.ApplyAsync(upload.Id, CancellationToken.None);
        Assert.Contains(applied.DraftStructureSchema.OrgUnitKinds, kind => kind.Key == "division");

        var tenantSettings = await context.TenantSettings.IgnoreQueryFilters().FirstAsync();
        var mergedSettings = TenantSettingsMerger.Merge(tenantSettings.SettingsOverrides, tenantSettings.Version);
        Assert.Contains(
            mergedSettings.DraftStructureSchema.OrgUnitKinds,
            kind => kind.Key == "division" && kind.DisplayLabel == "Division");
    }

    [Fact]
    public async Task ImportWorkflow_WithNonTemplateHeaders_RejectsUpload()
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

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UploadAsync(
                CreateCsvFile(
                    "wrong-headers.csv",
                    "ref,name,kind\nHQ,Head Office,Division\n"),
                CancellationToken.None));

        Assert.Contains("official draft-structure template", ex.Message);
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
}