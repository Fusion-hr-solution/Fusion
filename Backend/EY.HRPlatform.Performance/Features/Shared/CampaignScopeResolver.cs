using System.Reflection;

namespace EY.HRPlatform.Performance.Features.Shared;

/// <summary>
/// Works out which campaign a command writes to, from the identifier the command already carries.
/// </summary>
/// <remarks>
/// <para>
/// Design D2 asks for a pipeline gate plus a guard for commands that name their campaign
/// indirectly, so that no command can silently escape read-only archive semantics. This resolves
/// both cases from the command's own shape: a direct <c>CycleId</c>/<c>CampaignId</c>, or an
/// indirect <c>RoundId</c>, assignment id, check-in id, follow-up action id, or signal id.
/// </para>
/// <para>
/// The important property is the default: a command whose shape matches none of these is
/// <em>unresolvable</em>, and the coverage test fails unless it is explicitly exempt. New commands
/// are therefore covered by construction rather than by remembering to add a marker.
/// </para>
/// </remarks>
public static class CampaignScopeResolver
{
    public enum ScopeKind
    {
        /// <summary>Nothing on the command identifies a campaign.</summary>
        None,
        Campaign,
        Round,
        Assignment,
        CheckIn,
        FollowUpAction,
        DiscussionSignal
    }

    public sealed record CampaignScope(ScopeKind Kind, Guid Id);

    private static readonly (string Property, ScopeKind Kind)[] Conventions =
    [
        ("CycleId", ScopeKind.Campaign),
        ("CampaignId", ScopeKind.Campaign),
        ("RoundId", ScopeKind.Round),
        ("AssignmentId", ScopeKind.Assignment),
        ("ManagerAssignmentId", ScopeKind.Assignment),
        ("SelfAssignmentId", ScopeKind.Assignment),
        ("CheckInId", ScopeKind.CheckIn),
        ("ActionId", ScopeKind.FollowUpAction),
        ("SignalId", ScopeKind.DiscussionSignal)
    ];

    /// <summary>The scope a command type can resolve, ignoring the instance's values.</summary>
    public static ScopeKind ResolvableKind(Type commandType)
    {
        foreach (var (property, kind) in Conventions)
        {
            if (commandType.GetProperty(property, BindingFlags.Public | BindingFlags.Instance)?.PropertyType == typeof(Guid))
            {
                return kind;
            }
        }

        return ScopeKind.None;
    }

    /// <summary>The scope an actual command instance points at, or null when it names no campaign.</summary>
    public static CampaignScope? Resolve(object command)
    {
        foreach (var (property, kind) in Conventions)
        {
            var candidate = command.GetType().GetProperty(property, BindingFlags.Public | BindingFlags.Instance);
            if (candidate?.PropertyType != typeof(Guid))
            {
                continue;
            }

            var id = (Guid)candidate.GetValue(command)!;
            return id == Guid.Empty ? null : new CampaignScope(kind, id);
        }

        return null;
    }
}
