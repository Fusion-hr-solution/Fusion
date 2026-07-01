using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Workforce;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

/// <summary>
/// Re-resolves the people referenced by a campaign's curated responsibilities against the current
/// Core workforce and reports the delta since preparation. A delta that leaves a final approver
/// inactive or out of scope blocks launch (it must be re-curated); softer changes (an inactive
/// subject) require explicit operator acceptance.
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

        var resolved = (await workforceClient.ResolveEmployeesAsync(ids, cancellationToken))
            .ToDictionary(employee => employee.EmployeeId);

        var deltaItems = new List<CampaignWorkforceDeltaItemDto>();
        var inactiveSubjects = 0;
        var inactiveAssignees = 0;

        foreach (var item in items)
        {
            var subjectIssue = ResolveIssue(resolved, item.SubjectEmployeeId, "Subject");
            if (subjectIssue is not null)
            {
                inactiveSubjects++;
                deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                    item.SubjectEmployeeId, item.SubjectFullName, Guid.Empty, string.Empty, subjectIssue));
            }

            if (item.CurrentResponsibility is { } responsibility)
            {
                var assigneeIssue = ResolveIssue(resolved, responsibility.AssigneeEmployeeId, "Assignee");
                if (assigneeIssue is not null)
                {
                    inactiveAssignees++;
                    deltaItems.Add(new CampaignWorkforceDeltaItemDto(
                        item.SubjectEmployeeId, item.SubjectFullName,
                        responsibility.AssigneeEmployeeId, responsibility.AssigneeName, assigneeIssue));
                }
            }
        }

        return new CampaignWorkforceDeltaDto(
            inactiveSubjects, inactiveAssignees, inactiveAssignees > 0, deltaItems);
    }

    private static string? ResolveIssue(
        IReadOnlyDictionary<Guid, CoreEmployeeSummary> resolved, Guid employeeId, string role)
    {
        if (!resolved.TryGetValue(employeeId, out var employee))
            return $"{role}Missing";
        return employee.IsActive ? null : $"{role}Inactive";
    }
}
