using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public sealed record CampaignWorkforceMember(
    Guid EmployeeId,
    bool IsActive,
    IReadOnlyList<Guid> OrgUnitIds,
    Guid? PrimaryManagerEmployeeId,
    IReadOnlyList<Guid> PrimaryManagementChain,
    bool HasPrimaryChainCycle,
    uint EmployeeVersion,
    IReadOnlyList<Guid>? AncestorOrgUnitIds = null,
    IReadOnlyList<CampaignRelationshipCandidate>? RelationshipCandidates = null,
    bool IsPacketAReady = false,
    IReadOnlyList<string>? RemediationCodes = null)
{
    public IReadOnlyList<Guid> AncestorOrgUnitIds { get; init; } = AncestorOrgUnitIds ?? [];
    public IReadOnlyList<CampaignRelationshipCandidate> RelationshipCandidates { get; init; } = RelationshipCandidates ?? [];
    public IReadOnlyList<string> RemediationCodes { get; init; } = RemediationCodes ?? [];
}

/// <summary>Effective Core relationship fact that Performance may use as a candidate only.</summary>
public sealed record CampaignRelationshipCandidate(
    Guid RelationshipId,
    Guid SubjectEmployeeId,
    Guid ManagerEmployeeId,
    ReportingRelationshipType Type,
    Guid SubjectPositionAssignmentId,
    Guid ManagerPositionAssignmentId,
    string Source);

public sealed record CampaignWorkforceContext(
    DateTime AsOf,
    string SourceVersion,
    IReadOnlyList<CampaignWorkforceMember> Members);

public sealed record CampaignWorkforceMemberDelta(
    Guid EmployeeId,
    IReadOnlyList<string> ChangeCodes);

public sealed record CampaignWorkforceDelta(
    CampaignWorkforceContext Current,
    IReadOnlyList<CampaignWorkforceMemberDelta> Changes,
    IReadOnlyList<Guid> UnchangedEmployeeIds);

public interface ICampaignWorkforceContextService
{
    Task<CampaignWorkforceContext> GetAsync(DateTime asOf, CancellationToken cancellationToken = default);
    Task<CampaignWorkforceContext> GetAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken = default);
    Task<CampaignWorkforceContext> GetDeltaAsync(DateTime asOf, string baselineSourceVersion, CancellationToken cancellationToken = default);
    Task<CampaignWorkforceDelta> GetDeltaAsync(
        DateTime asOf,
        CampaignWorkforceContext baseline,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Core's campaign contract. It returns effective-dated workforce facts only; it does
/// not decide who may operate a Performance workflow.
/// </summary>
public sealed class CampaignWorkforceContextService(CoreHRDbContext dbContext) : ICampaignWorkforceContextService
{
    public async Task<CampaignWorkforceContext> GetAsync(DateTime asOf, CancellationToken cancellationToken = default)
        => await GetAsync(asOf, null, cancellationToken);

    public async Task<CampaignWorkforceContext> GetAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid>? employeeIds,
        CancellationToken cancellationToken = default)
    {
        var at = asOf.Kind == DateTimeKind.Utc ? asOf : asOf.ToUniversalTime();
        var selectedIds = employeeIds?.Where(id => id != Guid.Empty).ToHashSet();
        var employeeQuery = dbContext.Employees.AsNoTracking();
        if (selectedIds is { Count: > 0 })
            employeeQuery = employeeQuery.Where(employee => selectedIds.Contains(employee.Id));

        var employees = await employeeQuery.OrderBy(employee => employee.Id).ToListAsync(cancellationToken);
        var memberships = await dbContext.EmployeeOrgMemberships.AsNoTracking()
            .Where(membership => membership.EffectiveFrom <= at && (!membership.EffectiveTo.HasValue || membership.EffectiveTo > at))
            .ToListAsync(cancellationToken);
        var relationships = await dbContext.EmployeeReportingRelationships.AsNoTracking()
            .Where(relationship => relationship.EffectiveFrom <= at &&
                (!relationship.EffectiveTo.HasValue || relationship.EffectiveTo > at))
            .OrderByDescending(relationship => relationship.EffectiveFrom)
            .ToListAsync(cancellationToken);

        var positionAssignments = await dbContext.EmployeePositionAssignments.AsNoTracking()
            .Where(assignment => assignment.EffectiveFrom <= at &&
                (!assignment.EffectiveTo.HasValue || assignment.EffectiveTo > at))
            .ToListAsync(cancellationToken);
        var orgUnits = await dbContext.OrgUnits.AsNoTracking().ToListAsync(cancellationToken);

        var primaryRelationships = relationships
            .Where(relationship => relationship.Type == ReportingRelationshipType.PrimaryManager)
            .ToList();
        var primaryManagers = primaryRelationships
            .GroupBy(relationship => relationship.SubjectEmployeeId)
            .ToDictionary(group => group.Key, group => group.First().ManagerEmployeeId);
        var membershipsByEmployee = memberships.GroupBy(membership => membership.EmployeeId)
            .ToDictionary(group => group.Key, group => group.Select(membership => membership.OrgUnitId).Distinct().Order().ToArray());
        var primaryAssignmentsByEmployee = positionAssignments
            .Where(assignment => assignment.IsPrimary)
            .GroupBy(assignment => assignment.EmployeeId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(assignment => assignment.EffectiveFrom).ToArray());
        var candidatesByEmployee = relationships
            .GroupBy(relationship => relationship.SubjectEmployeeId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<CampaignRelationshipCandidate>)group
                    .OrderBy(relationship => relationship.Type)
                    .ThenBy(relationship => relationship.ManagerEmployeeId)
                    .Select(relationship => new CampaignRelationshipCandidate(
                        relationship.Id,
                        relationship.SubjectEmployeeId,
                        relationship.ManagerEmployeeId,
                        relationship.Type,
                        relationship.SubjectPositionAssignmentId,
                        relationship.ManagerPositionAssignmentId,
                        "CoreReportingRelationship"))
                    .ToArray());
        var parentByOrgUnit = orgUnits.ToDictionary(orgUnit => orgUnit.Id, orgUnit => orgUnit.ParentId);

        var members = employees.Select(employee =>
        {
            var chain = new List<Guid>();
            var visited = new HashSet<Guid> { employee.Id };
            var current = employee.Id;
            var hasCycle = false;
            while (primaryManagers.TryGetValue(current, out var managerId))
            {
                if (!visited.Add(managerId)) { hasCycle = true; break; }
                chain.Add(managerId);
                current = managerId;
            }

            var orgUnitIds = membershipsByEmployee.GetValueOrDefault(employee.Id, []);
            var ancestorOrgUnitIds = GetAncestorOrgUnitIds(orgUnitIds, parentByOrgUnit, out var hasOrgCycle);
            var remediationCodes = GetRemediationCodes(
                employee.Status == EmployeeStatus.Active,
                primaryAssignmentsByEmployee.GetValueOrDefault(employee.Id, []),
                orgUnitIds,
                hasCycle,
                hasOrgCycle);

            return new CampaignWorkforceMember(
                employee.Id,
                employee.Status == EmployeeStatus.Active,
                orgUnitIds,
                primaryManagers.GetValueOrDefault(employee.Id),
                chain,
                hasCycle,
                employee.Version,
                ancestorOrgUnitIds,
                candidatesByEmployee.GetValueOrDefault(employee.Id, []),
                remediationCodes.Count == 0,
                remediationCodes);
        }).ToArray();

        return new CampaignWorkforceContext(at, ComputeSourceVersion(members), members);
    }

    public async Task<CampaignWorkforceContext> GetDeltaAsync(DateTime asOf, string baselineSourceVersion, CancellationToken cancellationToken = default)
    {
        var current = await GetAsync(asOf, cancellationToken);
        return string.Equals(current.SourceVersion, baselineSourceVersion, StringComparison.Ordinal)
            ? current with { Members = [] }
            : current;
    }

    public async Task<CampaignWorkforceDelta> GetDeltaAsync(
        DateTime asOf,
        CampaignWorkforceContext baseline,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(baseline);

        var baselineByEmployee = baseline.Members.ToDictionary(member => member.EmployeeId);
        var current = await GetAsync(asOf, baselineByEmployee.Keys.ToArray(), cancellationToken);
        var currentByEmployee = current.Members.ToDictionary(member => member.EmployeeId);
        var changes = new List<CampaignWorkforceMemberDelta>();
        var unchanged = new List<Guid>();

        foreach (var (employeeId, baselineMember) in baselineByEmployee)
        {
            if (!currentByEmployee.TryGetValue(employeeId, out var currentMember))
            {
                changes.Add(new CampaignWorkforceMemberDelta(employeeId, ["EmployeeMissing"]));
                continue;
            }

            var changeCodes = GetChangeCodes(baselineMember, currentMember);
            if (changeCodes.Count == 0)
                unchanged.Add(employeeId);
            else
                changes.Add(new CampaignWorkforceMemberDelta(employeeId, changeCodes));
        }

        return new CampaignWorkforceDelta(current, changes, unchanged);
    }

    private static List<string> GetChangeCodes(
        CampaignWorkforceMember baseline,
        CampaignWorkforceMember current)
    {
        var changes = new List<string>();
        if (baseline.IsActive != current.IsActive)
            changes.Add("EmploymentStatusChanged");
        if (!baseline.OrgUnitIds.SequenceEqual(current.OrgUnitIds))
            changes.Add("OrgMembershipChanged");
        if (baseline.PrimaryManagerEmployeeId != current.PrimaryManagerEmployeeId)
            changes.Add("PrimaryManagerChanged");
        if (!baseline.PrimaryManagementChain.SequenceEqual(current.PrimaryManagementChain))
            changes.Add("PrimaryManagementChainChanged");
        if (baseline.HasPrimaryChainCycle != current.HasPrimaryChainCycle)
            changes.Add("PrimaryManagementCycleChanged");
        if (baseline.IsPacketAReady != current.IsPacketAReady ||
            !baseline.RemediationCodes.SequenceEqual(current.RemediationCodes))
            changes.Add("PacketAReadinessChanged");
        return changes;
    }

    private static IReadOnlyList<Guid> GetAncestorOrgUnitIds(
        IReadOnlyCollection<Guid> orgUnitIds,
        IReadOnlyDictionary<Guid, Guid?> parentByOrgUnit,
        out bool hasCycle)
    {
        var ancestors = new HashSet<Guid>();
        hasCycle = false;

        foreach (var orgUnitId in orgUnitIds)
        {
            var visited = new HashSet<Guid> { orgUnitId };
            var current = orgUnitId;
            while (parentByOrgUnit.TryGetValue(current, out var parentId) && parentId.HasValue)
            {
                if (!visited.Add(parentId.Value))
                {
                    hasCycle = true;
                    break;
                }

                ancestors.Add(parentId.Value);
                current = parentId.Value;
            }
        }

        return ancestors.Order().ToArray();
    }

    private static List<string> GetRemediationCodes(
        bool isActive,
        IReadOnlyCollection<Domain.Entities.EmployeePositionAssignment> primaryAssignments,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool hasPrimaryManagementCycle,
        bool hasOrgUnitCycle)
    {
        var codes = new List<string>();
        if (!isActive)
            codes.Add("InactiveEmployee");
        if (primaryAssignments.Count == 0 || primaryAssignments.All(assignment => !assignment.PositionId.HasValue))
            codes.Add("MissingCanonicalPrimaryPosition");
        if (primaryAssignments.Count(assignment => assignment.PositionId.HasValue) > 1)
            codes.Add("ConflictingPrimaryPositionAssignments");
        if (orgUnitIds.Count == 0)
            codes.Add("MissingPrimaryOrgMembership");
        if (hasPrimaryManagementCycle)
            codes.Add("PrimaryManagementCycle");
        if (hasOrgUnitCycle)
            codes.Add("OrgUnitHierarchyCycle");
        return codes;
    }

    private static string ComputeSourceVersion(IReadOnlyList<CampaignWorkforceMember> members)
    {
        var projection = string.Join('|', members.Select(member => string.Join(':', member.EmployeeId, member.IsActive,
            string.Join(',', member.OrgUnitIds), member.PrimaryManagerEmployeeId, string.Join(',', member.PrimaryManagementChain),
            string.Join(',', member.AncestorOrgUnitIds),
            string.Join(',', member.RelationshipCandidates.Select(candidate => $"{candidate.RelationshipId}:{candidate.Type}:{candidate.ManagerEmployeeId}")),
            member.HasPrimaryChainCycle, member.IsPacketAReady, string.Join(',', member.RemediationCodes), member.EmployeeVersion)));
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(projection)));
    }
}
