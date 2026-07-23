using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>Task 14.1 (configuration): scale/template create, lifecycle, freeze-when-in-use, and audit.</summary>
public class EvaluationConfigurationHandlerTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static System.Security.Claims.ClaimsPrincipal Manager() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .Build();

    private static IReadOnlyList<EvaluationRatingScaleLevelInput> ThreeLevels() =>
    [
        new(null, "Below", null, null),
        new(null, "Meets", null, null),
        new(null, "Exceeds", null, null),
    ];

    [Fact]
    public async Task CreateRatingScale_PersistsDraftUnderCallerTenant_AndWritesAudit()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"eval-config-scale-{Guid.NewGuid()}";
        var actor = Manager();

        await using (var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName))
        {
            var handler = new CreateEvaluationRatingScaleCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var result = await handler.Handle(
                new CreateEvaluationRatingScaleCommand(actor, "Delivery scale", null, ThreeLevels()), CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.Equal("Draft", result.Value.Status);
        }

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        var scale = await verify.EvaluationRatingScales.Include(x => x.Levels).SingleAsync();
        Assert.Equal(tenantId, scale.TenantId);
        Assert.Equal(EvaluationConfigStatus.Draft, scale.Status);
        Assert.Equal(3, scale.Levels.Count);
        Assert.Equal(1, await verify.PerformanceConfigurationAuditEntries.CountAsync(x => x.Action == "EvaluationRatingScaleCreated"));
    }

    [Fact]
    public async Task ActivateRatingScale_TransitionsDraftToActive_AndWritesAudit()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"eval-config-activate-{Guid.NewGuid()}";
        var actor = Manager();
        Guid scaleId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out var tenant, dbName))
        {
            var scale = EvaluationRatingScale.CreateDraft(tenantId, "Delivery scale", null, [new("Below"), new("Meets"), new("Exceeds")]);
            seed.EvaluationRatingScales.Add(scale);
            await seed.SaveChangesAsync();
            scaleId = scale.Id;
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName))
        {
            var handler = new SetEvaluationRatingScaleStatusCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var result = await handler.Handle(
                new SetEvaluationRatingScaleStatusCommand(actor, scaleId, EvaluationConfigStatus.Active), CancellationToken.None);
            Assert.True(result.IsSuccess);
        }

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        Assert.Equal(EvaluationConfigStatus.Active, (await verify.EvaluationRatingScales.SingleAsync()).Status);
        Assert.Equal(1, await verify.PerformanceConfigurationAuditEntries.CountAsync(x => x.Action == "EvaluationRatingScaleActive"));
    }

    [Fact]
    public async Task ActivateTemplate_WithNoSections_IsRejected()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"eval-config-empty-template-{Guid.NewGuid()}";
        var actor = Manager();
        Guid templateId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var template = EvaluationTemplate.CreateDraft(tenantId, "Empty template", null, null);
            seed.EvaluationTemplates.Add(template);
            await seed.SaveChangesAsync();
            templateId = template.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var handler = new SetEvaluationTemplateStatusCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
        var result = await handler.Handle(
            new SetEvaluationTemplateStatusCommand(actor, templateId, EvaluationConfigStatus.Active), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task StructuralEdit_WhenScaleInUse_ReturnsValidationFailure()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"eval-config-frozen-{Guid.NewGuid()}";
        var actor = Manager();
        Guid scaleId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var scale = EvaluationRatingScale.CreateDraft(tenantId, "Frozen scale", null, [new("Below"), new("Meets"), new("Exceeds")]);
            scale.Activate();
            scale.MarkInUse();
            seed.EvaluationRatingScales.Add(scale);
            await seed.SaveChangesAsync();
            scaleId = scale.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var handler = new UpdateEvaluationRatingScaleCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
        // Adding a fourth level structurally edits a frozen (in-use) scale — must fail.
        var result = await handler.Handle(new UpdateEvaluationRatingScaleCommand(
            actor, scaleId, "Frozen scale", null,
            [
                new(null, "Below", null, null),
                new(null, "Meets", null, null),
                new(null, "Exceeds", null, null),
                new(null, "Outstanding", null, null),
            ]), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task DuplicateTemplate_ProducesIndependentDraftCopy()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"eval-config-duplicate-{Guid.NewGuid()}";
        var actor = Manager();
        Guid sourceId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var template = EvaluationTemplate.CreateDraft(tenantId, "Source template", null, null);
            template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.OverallComments, "Overall comments"));
            template.Activate();
            seed.EvaluationTemplates.Add(template);
            await seed.SaveChangesAsync();
            sourceId = template.Id;
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName))
        {
            var handler = new DuplicateEvaluationTemplateCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var result = await handler.Handle(new DuplicateEvaluationTemplateCommand(actor, sourceId, "Copy template"), CancellationToken.None);
            Assert.True(result.IsSuccess);
            Assert.NotEqual(sourceId, result.Value.Id);
            Assert.Equal("Draft", result.Value.Status);
        }

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        Assert.Equal(2, await verify.EvaluationTemplates.CountAsync());
    }

    [Fact]
    public async Task CreateRatingScale_WithoutManagePermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant);
        var handler = new CreateEvaluationRatingScaleCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(
            new CreateEvaluationRatingScaleCommand(ClaimsPrincipalBuilder.Anonymous(), "Delivery scale", null, ThreeLevels()),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }
}
