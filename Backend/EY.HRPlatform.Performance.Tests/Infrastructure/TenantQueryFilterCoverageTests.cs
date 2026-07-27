using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

/// <summary>
/// Tenant isolation must be structural, not clerical (design D6). These tests are the control that
/// stops a new entity from shipping unfiltered: the filter is applied by convention over
/// <see cref="ITenantEntity"/>, and every exception is an explicitly declared, reviewable name.
/// </summary>
public sealed class TenantQueryFilterCoverageTests
{
    private static IModel BuildModel()
    {
        using var context = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        return context.Model;
    }

    [Fact]
    public void Every_tenant_entity_is_filtered()
    {
        var unfiltered = BuildModel().GetEntityTypes()
            .Where(entity => !entity.IsOwned())
            .Where(entity => typeof(ITenantEntity).IsAssignableFrom(entity.ClrType))
            .Where(entity => entity.GetDeclaredQueryFilters().Count == 0)
            .Select(entity => entity.ClrType.Name)
            .OrderBy(name => name)
            .ToList();

        Assert.Empty(unfiltered);
    }

    [Fact]
    public void Every_mapped_entity_is_either_filtered_or_explicitly_exempt()
    {
        var unaccounted = BuildModel().GetEntityTypes()
            .Where(entity => !entity.IsOwned())
            .Where(entity => entity.GetDeclaredQueryFilters().Count == 0)
            .Select(entity => entity.ClrType.Name)
            .Where(name => !PerformanceDbContext.PlatformScopedEntities.Contains(name))
            .OrderBy(name => name)
            .ToList();

        // A new entity that is neither tenant-scoped nor deliberately platform-scoped fails here,
        // rather than silently shipping readable across tenants.
        Assert.Empty(unaccounted);
    }

    [Fact]
    public void The_platform_scoped_exemptions_are_all_still_real_and_still_unfiltered()
    {
        var model = BuildModel();

        foreach (var exempt in PerformanceDbContext.PlatformScopedEntities)
        {
            var entity = model.GetEntityTypes()
                .SingleOrDefault(candidate => candidate.ClrType.Name == exempt);

            Assert.NotNull(entity);
            Assert.Empty(entity!.GetDeclaredQueryFilters());
            Assert.False(typeof(ITenantEntity).IsAssignableFrom(entity.ClrType));
        }
    }

    [Fact]
    public void The_conversion_preserved_the_filtered_entity_set()
    {
        var filtered = BuildModel().GetEntityTypes()
            .Where(entity => !entity.IsOwned())
            .Where(entity => entity.GetDeclaredQueryFilters().Count > 0)
            .Select(entity => entity.ClrType.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

        // Captured from the 59 hand-written HasQueryFilter calls this convention replaced, less
        // the two strategic entities removed with the tenant strategic library. A change
        // here means an entity gained or lost tenant filtering — deliberate or not.
        Assert.Equal(ExpectedFilteredEntities, filtered);
    }

    private static readonly string[] ExpectedFilteredEntities = [
        "ActivityLogEntry",
        "ApprovalDelegate",
        "Attachment",
        "CampaignStrategicObjective",
        "CampaignTeamObjective",
        "CheckInFollowUpAction",
        "EmployeeObjectivePlan",
        "EvaluationAssignment",
        "EvaluationObjectivePlanSnapshot",
        "EvaluationObjectiveRating",
        "EvaluationObjectiveSnapshot",
        "EvaluationQuestionAnswer",
        "EvaluationRatingScale",
        "EvaluationRatingScaleLevel",
        "EvaluationRound",
        "EvaluationRoundDeadlineExtension",
        "EvaluationRoundExclusion",
        "EvaluationRoundParticipant",
        "EvaluationRoundPolicySnapshot",
        "EvaluationRoundProficiencyDraftLevel",
        "EvaluationRoundReviewerCorrection",
        "EvaluationRoundScaleDraftLevel",
        "EvaluationRoundScaleSnapshot",
        "EvaluationRoundScaleSnapshotLevel",
        "EvaluationRoundSkillDraftItem",
        "EvaluationRoundSkillSnapshot",
        "EvaluationRoundSkillSnapshotItem",
        "EvaluationRoundSkillSnapshotLevel",
        "EvaluationRoundTemplateDraftQuestion",
        "EvaluationRoundTemplateDraftSection",
        "EvaluationRoundTemplateSnapshot",
        "EvaluationRoundTemplateSnapshotQuestion",
        "EvaluationRoundTemplateSnapshotSection",
        "EvaluationSkillRating",
        "EvaluationTemplate",
        "EvaluationTemplateQuestion",
        "EvaluationTemplateSection",
        "ObjectiveDiscussionSignal",
        "ObjectiveProgressUpdate",
        "PerformanceCheckIn",
        "PerformanceCycle",
        "PerformanceCycleApproverOverride",
        "PerformanceCycleApproverReassignment",
        "PerformanceCycleAuditEvent",
        "PerformanceCycleParticipant",
        "PerformanceCycleParticipantExclusion",
        "PerformanceCyclePopulationRule",
        "PerformanceNotification",
        "PerformancePlanningReminder",
        "ProficiencyScale",
        "ProficiencyScaleLevel",
        "Skill",
        "SkillCategory",
        "SkillExpectationItem",
        "SkillExpectationSet",
        "TenantObjectivePolicy",
        "TenantObjectivePolicyVersion"
    ];
}
