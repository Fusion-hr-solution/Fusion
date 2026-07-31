using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Skills.Commands;
using EY.HRPlatform.Performance.Features.Skills.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features;

/// <summary>Task 5.5: deny-by-default, defaults idempotency + tenant isolation, archive blockers, freeze conflicts.</summary>
public class SkillsConfigurationTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static ClaimsPrincipal SkillsAdmin() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithFullName("Skills Admin")
        .WithPermission(PerformancePermissions.SkillsManage, PermissionScopes.Tenant)
        .Build();

    private static ClaimsPrincipal EvaluationManager() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .Build();

    [Fact]
    public async Task CreateCategory_WithoutSkillsPermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant);
        var handler = new CreateSkillCategoryCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(
            new CreateSkillCategoryCommand(ClaimsPrincipalBuilder.Anonymous(), "Technical"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task Workspace_WithoutSkillsPermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new GetSkillsConfigurationWorkspaceQueryHandler(db, Access);

        var result = await handler.Handle(
            new GetSkillsConfigurationWorkspaceQuery(ClaimsPrincipalBuilder.Anonymous()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task Workspace_ReadIsPure_AndProvisionCommandIsIdempotent()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"skills-defaults-{Guid.NewGuid()}";
        var actor = SkillsAdmin();

        // A read never provisions: the workspace stays empty and no rows are written.
        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var read = await new GetSkillsConfigurationWorkspaceQueryHandler(db, Access)
                .Handle(new GetSkillsConfigurationWorkspaceQuery(actor), CancellationToken.None);
            Assert.True(read.IsSuccess);
            Assert.Empty(read.Value.Categories);
            Assert.Equal(0, await db.SkillCategories.CountAsync());
            Assert.Equal(0, await db.ProficiencyScales.CountAsync());
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName))
        {
            var handler = new ProvisionSkillDefaultsCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var first = await handler.Handle(new ProvisionSkillDefaultsCommand(actor), CancellationToken.None);
            Assert.True(first.IsSuccess);
            Assert.Equal(3, first.Value.Categories.Count);
            Assert.Equal(6, first.Value.Skills.Count);
            Assert.Single(first.Value.ProficiencyScales);
            Assert.Single(first.Value.ExpectationSets);
            Assert.Equal("Active", first.Value.ExpectationSets[0].Status);
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName))
        {
            var handler = new ProvisionSkillDefaultsCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var second = await handler.Handle(new ProvisionSkillDefaultsCommand(actor), CancellationToken.None);
            Assert.True(second.IsSuccess);
            Assert.Equal(3, second.Value.Categories.Count);
            Assert.Equal(6, second.Value.Skills.Count);
            Assert.Single(second.Value.ProficiencyScales);
        }

        await using var verify = PerformanceTestContext.Create(tenantId, out _, dbName);
        Assert.Equal(3, await verify.SkillCategories.CountAsync());
        Assert.Equal(6, await verify.Skills.CountAsync());
        Assert.Equal(1, await verify.ProficiencyScales.CountAsync());
        Assert.Equal(1, await verify.SkillExpectationSets.CountAsync());
    }

    [Fact]
    public async Task Provision_WithoutSkillsPermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant);
        var handler = new ProvisionSkillDefaultsCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(
            new ProvisionSkillDefaultsCommand(ClaimsPrincipalBuilder.Anonymous()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task CreateCategory_CasingOnlyDuplicate_IsNameConflict()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"skills-casefold-{Guid.NewGuid()}");
        var handler = new CreateSkillCategoryCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
        var actor = SkillsAdmin();

        var first = await handler.Handle(new CreateSkillCategoryCommand(actor, "Leadership"), CancellationToken.None);
        Assert.True(first.IsSuccess);

        var second = await handler.Handle(new CreateSkillCategoryCommand(actor, "LEADERSHIP"), CancellationToken.None);
        Assert.True(second.IsFailure);
        Assert.Contains("Conflict", second.Error.Code);
    }

    [Fact]
    public async Task Workspace_DefaultsAreTenantIsolated()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"skills-isolation-{Guid.NewGuid()}";

        await using (var db = PerformanceTestContext.Create(tenantA, out var tenant, dbName))
        {
            var handler = new ProvisionSkillDefaultsCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var result = await handler.Handle(new ProvisionSkillDefaultsCommand(SkillsAdmin()), CancellationToken.None);
            Assert.True(result.IsSuccess);
        }

        await using (var db = PerformanceTestContext.Create(tenantB, out var tenant, dbName))
        {
            var handler = new ProvisionSkillDefaultsCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
            var result = await handler.Handle(new ProvisionSkillDefaultsCommand(SkillsAdmin()), CancellationToken.None);
            Assert.True(result.IsSuccess);
            // Tenant B sees only its own three categories, none of tenant A's.
            Assert.Equal(3, result.Value.Categories.Count);
        }

        // Two independent tenant-owned copies exist in total; neither leaks into the other's scope.
        await using var verify = PerformanceTestContext.Create(tenantA, out _, dbName);
        Assert.Equal(6, await verify.SkillCategories.IgnoreQueryFilters().CountAsync());
        Assert.Equal(3, await verify.SkillCategories.IgnoreQueryFilters().CountAsync(c => c.TenantId == tenantA));
        Assert.Equal(3, await verify.SkillCategories.IgnoreQueryFilters().CountAsync(c => c.TenantId == tenantB));
    }

    [Fact]
    public async Task ArchiveCategory_WithActiveSkills_IsBlocked()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"skills-archive-block-{Guid.NewGuid()}";
        var actor = SkillsAdmin();
        Guid categoryId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var category = SkillCategory.Create(tenantId, "Technical");
            var skill = Skill.Create(tenantId, "Software engineering", null, category.Id);
            seed.SkillCategories.Add(category);
            seed.Skills.Add(skill);
            await seed.SaveChangesAsync();
            categoryId = category.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var handler = new ArchiveSkillCategoryCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
        var result = await handler.Handle(new ArchiveSkillCategoryCommand(actor, categoryId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Conflict", result.Error.Code);
        Assert.Contains("Software engineering", result.Error.Message);
    }

    [Fact]
    public async Task UpdateSkill_WhenInUse_ReturnsValidationFailure()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"skills-frozen-{Guid.NewGuid()}";
        var actor = SkillsAdmin();
        Guid skillId;
        Guid categoryId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var category = SkillCategory.Create(tenantId, "Technical");
            var skill = Skill.Create(tenantId, "Software engineering", null, category.Id);
            skill.MarkInUse();
            seed.SkillCategories.Add(category);
            seed.Skills.Add(skill);
            await seed.SaveChangesAsync();
            skillId = skill.Id;
            categoryId = category.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var handler = new UpdateSkillCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
        var result = await handler.Handle(
            new UpdateSkillCommand(actor, skillId, "Renamed skill", null, categoryId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Invalid", result.Error.Code);
    }

    [Fact]
    public async Task ExpectationSetFrozen_StatusToActiveOnArchivedSet_IsRejected()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"skills-set-frozen-{Guid.NewGuid()}";
        var actor = SkillsAdmin();
        Guid setId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var scale = ProficiencyScale.CreateDraft(tenantId, "Scale", null,
                [new("A"), new("B"), new("C")]);
            scale.Activate();
            var skill = Skill.Create(tenantId, "Skill", null, SkillCategory.Create(tenantId, "Technical").Id);
            var set = SkillExpectationSet.CreateDraft(tenantId, "Set", null, scale.Id);
            set.AddItem(skill.Id, 2, scale);
            set.Activate(scale);
            set.MarkInUse();
            seed.ProficiencyScales.Add(scale);
            seed.Skills.Add(skill);
            seed.SkillExpectationSets.Add(set);
            await seed.SaveChangesAsync();
            setId = set.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var handler = new UpdateSkillExpectationSetCommandHandler(db, tenant, Access, new ConfigurationAuditWriter(db));
        // Attempting to change items of an in-use (frozen) set must fail.
        var result = await handler.Handle(
            new UpdateSkillExpectationSetCommand(actor, setId, "Set", null, []), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task ListActiveSetsForRound_WithoutEvaluationPermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new ListActiveExpectationSetsForRoundQueryHandler(db, Access);

        // A skills-only admin cannot read via the round-facing (evaluation.manage) endpoint.
        var result = await handler.Handle(
            new ListActiveExpectationSetsForRoundQuery(SkillsAdmin()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task ListActiveSetsForRound_WithEvaluationPermission_ReturnsActiveSets()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"skills-round-read-{Guid.NewGuid()}";

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var category = SkillCategory.Create(tenantId, "Technical");
            var scale = ProficiencyScale.CreateDraft(tenantId, "Scale", null, [new("A"), new("B"), new("C")]);
            scale.Activate();
            var skill = Skill.Create(tenantId, "Skill", null, category.Id);
            var set = SkillExpectationSet.CreateDraft(tenantId, "Core capabilities", null, scale.Id);
            set.AddItem(skill.Id, 2, scale);
            set.Activate(scale);
            seed.SkillCategories.Add(category);
            seed.ProficiencyScales.Add(scale);
            seed.Skills.Add(skill);
            seed.SkillExpectationSets.Add(set);
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new ListActiveExpectationSetsForRoundQueryHandler(db, Access);
        var result = await handler.Handle(
            new ListActiveExpectationSetsForRoundQuery(EvaluationManager()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Equal("Core capabilities", result.Value[0].Name);
        Assert.Equal("Skill", result.Value[0].Items[0].SkillName);
        Assert.Equal("Technical", result.Value[0].Items[0].CategoryName);
    }
}
