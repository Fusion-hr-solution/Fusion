using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectiveTemplates;

public class TemplateActivationRulesTests
{
    private static ClaimsPrincipal Actor() => new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("full_name", "Template Admin"),
        ],
        "test"));

    private static void SeedActivePolicy(PerformanceDbContext db, Guid tenantId)
    {
        var policy = TenantObjectivePolicy.Create(tenantId);
        policy.ApplyPolicy(5, "10,20,25,50,100", 5, "Optional", "Quantitative,Qualitative", true, Guid.NewGuid(), "Tester", null);
        db.TenantObjectivePolicies.Add(policy);
    }

    private static ObjectiveTemplateCategory SeedCategory(PerformanceDbContext db, Guid tenantId, string code = "LEAD")
    {
        var category = ObjectiveTemplateCategory.Create(tenantId, code, $"Category {code}");
        db.ObjectiveTemplateCategories.Add(category);
        return category;
    }

    private static ActivateTemplateRevisionCommandHandler ActivationHandler(PerformanceDbContext db, ITenantContext tenantContext)
        => new(db, tenantContext, new ConfigurationAuditWriter(db), new TemplateRevisionValidator(db));

    private static Task<EY.HRPlatform.SharedKernel.Results.Result<TemplateDto>> ActivateAsync(
        PerformanceDbContext db, ITenantContext tenantContext, ObjectiveTemplate template)
        => ActivationHandler(db, tenantContext).Handle(
            new ActivateTemplateRevisionCommand(
                template.Id, Actor(),
                new ActivateTemplateRevisionRequest(null, template.DraftRevision!.Version)),
            CancellationToken.None);

    [Fact]
    public async Task Activation_Requires_A_Primary_Category()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedActivePolicy(db, tenantId);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "No Category", null, null, "Qualitative", null, null, null, null, "Criteria",
            Guid.NewGuid().ToString(), "Author", expectedOutcome: "Outcome");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var result = await ActivateAsync(db, tenantContext, template);

        Assert.True(result.IsFailure);
        Assert.Contains("primary category", result.Error.Message);
    }

    [Fact]
    public async Task Activation_Rejects_An_Archived_Category()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedActivePolicy(db, tenantId);
        var category = SeedCategory(db, tenantId);
        category.Archive();

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Archived Category", null, category.Id, "Qualitative", null, null, null, null, "Criteria",
            Guid.NewGuid().ToString(), "Author", expectedOutcome: "Outcome");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var result = await ActivateAsync(db, tenantContext, template);

        Assert.True(result.IsFailure);
        Assert.Contains("archived", result.Error.Message);
    }

    [Fact]
    public async Task Quantitative_Activation_Requires_Indicator_Target_And_Unit()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedActivePolicy(db, tenantId);
        var category = SeedCategory(db, tenantId);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Sales Growth", null, category.Id, "Quantitative", null, null, null, null, null,
            Guid.NewGuid().ToString(), "Author");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var result = await ActivateAsync(db, tenantContext, template);

        Assert.True(result.IsFailure);
        Assert.Contains("indicator", result.Error.Message);
        Assert.Contains("target", result.Error.Message);
        Assert.Contains("unit", result.Error.Message);
    }

    [Fact]
    public async Task Complete_Quantitative_Template_Activates()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedActivePolicy(db, tenantId);
        var category = SeedCategory(db, tenantId);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Sales Growth", null, category.Id, "Quantitative", null, null, 15m, "%", null,
            Guid.NewGuid().ToString(), "Author", indicator: "Quarterly revenue growth");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var result = await ActivateAsync(db, tenantContext, template);

        Assert.True(result.IsSuccess);
        Assert.Equal("Active", result.Value.Status);
        Assert.Equal("Quarterly revenue growth", result.Value.ActiveRevision?.Indicator);
    }

    [Fact]
    public async Task Qualitative_Activation_Requires_Expected_Outcome_And_Success_Criteria()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedActivePolicy(db, tenantId);
        var category = SeedCategory(db, tenantId);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Coaching Quality", null, category.Id, "Qualitative", null, null, null, null, null,
            Guid.NewGuid().ToString(), "Author");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var result = await ActivateAsync(db, tenantContext, template);

        Assert.True(result.IsFailure);
        Assert.Contains("expected outcome", result.Error.Message);
        Assert.Contains("success criteria", result.Error.Message);
    }

    [Fact]
    public async Task Delete_Removes_An_Unused_Never_Activated_Draft()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Disposable Draft", null, null, "Qualitative", null, null, null, null, null,
            Guid.NewGuid().ToString(), "Author");
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var handler = new DeleteTemplateDraftCommandHandler(db, tenantContext, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(new DeleteTemplateDraftCommand(template.Id, Actor()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(db.ObjectiveTemplateContainers.ToList());
    }

    [Fact]
    public async Task Delete_Rejects_An_Activated_Template()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Activated", null, null, "Qualitative", null, null, null, null, "Criteria",
            Guid.NewGuid().ToString(), "Author", expectedOutcome: "Outcome");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Author", null);
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var handler = new DeleteTemplateDraftCommandHandler(db, tenantContext, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(new DeleteTemplateDraftCommand(template.Id, Actor()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Archive", result.Error.Message);
        Assert.Single(db.ObjectiveTemplateContainers.ToList());
    }

    [Fact]
    public async Task Restore_Returns_A_Policy_Compatible_Template_To_Use()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedActivePolicy(db, tenantId);
        var category = SeedCategory(db, tenantId);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Compatible", null, category.Id, "Qualitative", 20m, null, null, null, "Criteria",
            Guid.NewGuid().ToString(), "Author", expectedOutcome: "Outcome");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Author", null);
        template.Archive();
        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var handler = new RestoreTemplateCommandHandler(
            db, tenantContext, new ConfigurationAuditWriter(db), new TemplateRevisionValidator(db));

        var result = await handler.Handle(new RestoreTemplateCommand(template.Id, Actor()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Active", result.Value.Status);
    }

    [Fact]
    public async Task Restore_Is_Blocked_When_The_Template_No_Longer_Complies_With_Policy()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"restore-drift-{Guid.NewGuid()}";
        Guid templateId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var category = SeedCategory(seed, tenantId);

            // Policy that does NOT allow weight 20: the archived template drifted out of compliance.
            var policy = TenantObjectivePolicy.Create(tenantId);
            policy.ApplyPolicy(5, "25,50,100", 5, "Optional", "Quantitative,Qualitative", true, Guid.NewGuid(), "Tester", null);
            seed.TenantObjectivePolicies.Add(policy);

            var template = ObjectiveTemplate.Create(tenantId);
            template.CreateDraftRevision(
                "Drifted", null, category.Id, "Qualitative", 20m, null, null, null, "Criteria",
                Guid.NewGuid().ToString(), "Author", expectedOutcome: "Outcome");
            template.ActivateRevision(Guid.NewGuid().ToString(), "Author", null);
            template.Archive();
            seed.ObjectiveTemplateContainers.Add(template);
            await seed.SaveChangesAsync();
            templateId = template.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext, dbName);
        var handler = new RestoreTemplateCommandHandler(
            db, tenantContext, new ConfigurationAuditWriter(db), new TemplateRevisionValidator(db));

        var result = await handler.Handle(new RestoreTemplateCommand(templateId, Actor()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("no longer complies", result.Error.Message);
    }

    [Fact]
    public async Task Duplication_Generates_A_New_Stable_Code_And_Copies_Measurement_Content()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var source = ObjectiveTemplate.Create(tenantId);
        source.CreateDraftRevision(
            "Sales Growth", null, null, "Quantitative", null, null, 15m, "%", null,
            Guid.NewGuid().ToString(), "Author", indicator: "Quarterly revenue growth");
        db.ObjectiveTemplateContainers.Add(source);
        await db.SaveChangesAsync();

        var handler = new DuplicateTemplateCommandHandler(db, tenantContext, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(new DuplicateTemplateCommand(source.Id, Actor()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(source.Id, result.Value.Id);
        Assert.NotEqual(source.Code, result.Value.Code);
        Assert.StartsWith("TPL-", result.Value.Code);
        Assert.Equal("Quarterly revenue growth", result.Value.DraftRevision?.Indicator);
    }
}
