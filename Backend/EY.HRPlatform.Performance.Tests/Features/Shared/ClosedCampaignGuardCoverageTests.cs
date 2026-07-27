using System.Reflection;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.Performance.Tests.Features.Shared;

/// <summary>
/// The control that stops a future command from silently escaping the closed-campaign guard
/// (design D2). Every command in the module must either resolve a campaign — directly or through
/// the round, assignment, check-in, follow-up action, or discussion signal it names — or appear
/// with a stated reason in the exemption set below.
/// </summary>
public sealed class ClosedCampaignGuardCoverageTests
{
    private static IReadOnlyList<Type> AllCommands() => typeof(PerformanceDbContext).Assembly
        .GetTypes()
        .Where(type => type is { IsAbstract: false, IsInterface: false })
        .Where(type => type.GetInterfaces().Any(contract =>
            contract == typeof(ICommand)
            || (contract.IsGenericType && contract.GetGenericTypeDefinition() == typeof(ICommand<>))))
        .OrderBy(type => type.Name, StringComparer.Ordinal)
        .ToList();

    /// <summary>
    /// Commands that write nothing campaign-scoped, plus the one deliberate post-closure exception.
    /// Each name here is a decision someone can review, not an omission.
    /// </summary>
    private static readonly HashSet<string> ExpectedExempt = new(StringComparer.Ordinal)
    {
        // The deliberate exception: acknowledgement does not gate closure, so it survives it.
        "AcknowledgeEvaluationCommand",

        // Creates a campaign — there is no prior campaign whose closure could apply.
        "CreateCycleCommand",

        // Tenant- and platform-level configuration, not campaign state.
        "ApplyObjectivePlanningConfigurationCommand",
        "ApplyPlatformPerformanceConfigurationCommand",

        // Skills catalogue: tenant-level reference data reused across campaigns.
        "CreateSkillCommand",
        "UpdateSkillCommand",
        "ArchiveSkillCommand",
        "CreateSkillCategoryCommand",
        "UpdateSkillCategoryCommand",
        "ArchiveSkillCategoryCommand",
        "CreateSkillExpectationSetCommand",
        "UpdateSkillExpectationSetCommand",
        "DuplicateSkillExpectationSetCommand",
        "SetSkillExpectationSetStatusCommand",
        "CreateProficiencyScaleCommand",
        "UpdateProficiencyScaleCommand",
        "DuplicateProficiencyScaleCommand",
        "SetProficiencyScaleStatusCommand",

        // Evaluation configuration library: tenant-level, versioned, reused across campaigns.
        "CreateEvaluationRatingScaleCommand",
        "UpdateEvaluationRatingScaleCommand",
        "DuplicateEvaluationRatingScaleCommand",
        "SetEvaluationRatingScaleStatusCommand",
        "CreateEvaluationTemplateCommand",
        "UpdateEvaluationTemplateCommand",
        "DuplicateEvaluationTemplateCommand",
        "SetEvaluationTemplateStatusCommand",

        // A user's own notification state, independent of any campaign's lifecycle.
        "MarkNotificationReadCommand",
        "MarkAllNotificationsReadCommand",

        // Tenant provisioning: runs before any campaign exists.
        "ProvisionTenantCommand",
        "ProvisionSkillDefaultsCommand",
    };

    [Fact]
    public void Every_command_either_resolves_a_campaign_or_is_explicitly_exempt()
    {
        var unaccounted = AllCommands()
            .Where(command => CampaignScopeResolver.ResolvableKind(command) == CampaignScopeResolver.ScopeKind.None)
            .Select(command => command.Name)
            .Where(name => !ExpectedExempt.Contains(name))
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

        // A new campaign-scoped command that names its campaign in an unrecognised way fails here,
        // rather than shipping able to write to a closed archive.
        Assert.Empty(unaccounted);
    }

    [Fact]
    public void The_exemption_set_contains_no_stale_entries()
    {
        var commandNames = AllCommands().Select(command => command.Name).ToHashSet(StringComparer.Ordinal);

        var stale = ExpectedExempt.Where(name => !commandNames.Contains(name)).OrderBy(name => name).ToList();

        Assert.Empty(stale);
    }

    [Fact]
    public void No_exempt_command_silently_became_campaign_scoped()
    {
        var nowResolvable = AllCommands()
            .Where(command => ExpectedExempt.Contains(command.Name))
            .Where(command => CampaignScopeResolver.ResolvableKind(command) != CampaignScopeResolver.ScopeKind.None)
            .Where(command => command.GetCustomAttribute<ClosedCampaignExemptAttribute>() is null)
            .Select(command => command.Name)
            .ToList();

        // An exempt command that gained a campaign identifier must either drop off this list or
        // carry the attribute stating why it stays exempt.
        Assert.Empty(nowResolvable);
    }

    [Fact]
    public void Acknowledgement_is_the_only_attribute_declared_exemption()
    {
        var declared = AllCommands()
            .Where(command => command.GetCustomAttribute<ClosedCampaignExemptAttribute>() is not null)
            .Select(command => command.Name)
            .ToList();

        Assert.Equal(["AcknowledgeEvaluationCommand"], declared);
    }

    [Fact]
    public void The_declared_exemption_states_a_reason()
    {
        var attribute = AllCommands()
            .Single(command => command.Name == "AcknowledgeEvaluationCommand")
            .GetCustomAttribute<ClosedCampaignExemptAttribute>();

        Assert.NotNull(attribute);
        Assert.False(string.IsNullOrWhiteSpace(attribute!.Reason));
    }

    [Theory]
    [InlineData("LaunchCampaignCommand", CampaignScopeResolver.ScopeKind.Campaign)]
    [InlineData("LockPlanningCommand", CampaignScopeResolver.ScopeKind.Campaign)]
    [InlineData("ApproveObjectivePlanCommand", CampaignScopeResolver.ScopeKind.Campaign)]
    [InlineData("RecordObjectiveProgressCommand", CampaignScopeResolver.ScopeKind.Campaign)]
    [InlineData("CreateEvaluationRoundCommand", CampaignScopeResolver.ScopeKind.Campaign)]
    [InlineData("LaunchEvaluationRoundCommand", CampaignScopeResolver.ScopeKind.Round)]
    [InlineData("SetEvaluationRoundExclusionCommand", CampaignScopeResolver.ScopeKind.Round)]
    [InlineData("FinalizeEvaluationCommand", CampaignScopeResolver.ScopeKind.Assignment)]
    [InlineData("SubmitSelfCommand", CampaignScopeResolver.ScopeKind.Assignment)]
    [InlineData("SaveManagerDraftCommand", CampaignScopeResolver.ScopeKind.Assignment)]
    [InlineData("CompleteCheckInCommand", CampaignScopeResolver.ScopeKind.CheckIn)]
    [InlineData("CompleteFollowUpActionCommand", CampaignScopeResolver.ScopeKind.FollowUpAction)]
    [InlineData("CloseDiscussionSignalCommand", CampaignScopeResolver.ScopeKind.DiscussionSignal)]
    public void Representative_commands_resolve_through_the_expected_route(
        string commandName, CampaignScopeResolver.ScopeKind expected)
    {
        var command = AllCommands().Single(candidate => candidate.Name == commandName);

        Assert.Equal(expected, CampaignScopeResolver.ResolvableKind(command));
    }
}
