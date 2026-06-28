using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Workforce;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

/// <summary>
/// Re-resolves the people referenced by a campaign's curated responsibilities against the current
/// canonical Core campaign workforce context and reports the delta since preparation. A delta that
/// leaves a final approver inactive/missing or no longer aligned to the subject's current primary
/// manager blocks launch; softer changes (subject inactivity, org changes, manager changes, or
/// canonical readiness drift) require explicit operator acceptance.
/// </summary>
internal static class CampaignWorkforceDeltaResolver
{
    public static async Task<CampaignWorkforceDeltaDto> ComputeAsync(
        IReadOnlyList<CampaignResponsibilityWorkItemDto> items,
        ICoreWorkforceClient workforceClient,
        CancellationToken cancellationToken)
    {
        var ids = new HashSet<Guid>();
        foreach (var item in items)
        {
            ids.Add(item.SubjectEmployeeId);
            if (item.CurrentResponsibility is not null)
                ids.Add(item.CurrentResponsibility.AssigneeEmployeeId);
        }

        if (ids.Count == 0)
            return new CampaignWorkforceDeltaDto(0, 0, false, []);

        var asOf = DateTime.UtcNow;
        var context = await workforceClient.GetCampaignWorkforceContextAsync(asOf, ids, cancellationToken);
        var membersByEmployee = context.Members.ToDictionary(member => member.EmployeeId);

        var deltaItems = new List<CampaignWorkforceDeltaItemDto>();
        var inactiveSubjects = 0;
        var blockingAssigneeIssues = 0;

        foreach (var item in items)
        {
            membersByEmployee.TryGetValue(item.SubjectEmployeeId, out var subject);
            var subjectIssue = ResolvePresenceIssue(subject, "Subject");
            if (subjectIssue is not null)
            {
                inactiveSubjects++;
                deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                    item.SubjectEmployeeId, item.SubjectFullName, Guid.Empty, string.Empty, subjectIssue));
            }
            else if (subject is not null)
            {
                if (item.SubjectOrgUnitId.HasValue && !subject.OrgUnitIds.Contains(item.SubjectOrgUnitId.Value))
                {
                    deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                        item.SubjectEmployeeId, item.SubjectFullName, Guid.Empty, string.Empty, "SubjectPrimaryOrgAssignmentChanged"));
                }

                if (item.SubjectPrimaryManagerEmployeeId != subject.PrimaryManagerEmployeeId)
                {
                    deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                        item.SubjectEmployeeId, item.SubjectFullName, Guid.Empty, string.Empty, "SubjectPrimaryManagerChanged"));
                }

                if (!subject.IsPacketAReady && subject.RemediationCodes.Count > 0)
                {
                    deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                        item.SubjectEmployeeId,
                        item.SubjectFullName,
                        Guid.Empty,
                        string.Empty,
                        $"SubjectNotReady:{string.Join(',', subject.RemediationCodes)}"));
                }
            }

            if (item.CurrentResponsibility is { } responsibility)
            {
                membersByEmployee.TryGetValue(responsibility.AssigneeEmployeeId, out var assignee);
                var assigneeIssue = ResolvePresenceIssue(assignee, "Assignee");
                if (assigneeIssue is not null)
                {
                    blockingAssigneeIssues++;
                    deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                        item.SubjectEmployeeId, item.SubjectFullName,
                        responsibility.AssigneeEmployeeId, responsibility.AssigneeName, assigneeIssue));
                }
                else if (subject is not null
                    && string.Equals(responsibility.RelationshipSource, "PrimaryManager", StringComparison.Ordinal)
                    && subject.PrimaryManagerEmployeeId != responsibility.AssigneeEmployeeId)
                {
                    blockingAssigneeIssues++;
                    deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                        item.SubjectEmployeeId,
                        item.SubjectFullName,
                        responsibility.AssigneeEmployeeId,
                        responsibility.AssigneeName,
                        "AssigneeNoLongerPrimaryManager"));
                }
            }
        }

        return new CampaignWorkforceDeltaDto(
            inactiveSubjects, blockingAssigneeIssues, blockingAssigneeIssues > 0, deltaItems);
    }

    private static string? ResolvePresenceIssue(
        CoreCampaignWorkforceMember? member,
        string role)
    {
        if (member is null)
            return $"{role}Missing";

        return member.IsActive ? null : $"{role}Inactive";
    }
}
