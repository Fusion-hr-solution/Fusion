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
    Guid SubjectWorkAssignmentId,
    Guid ManagerWorkAssignmentId,
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
    private sealed record ActivePrimaryWorkAssignment(
        Guid WorkAssignmentId,
        Guid EmploymentId,
        Guid EmployeeId,
        Guid OrgUnitId,
        DateTime EffectiveFrom);

    private sealed record EffectiveManagerRelationship(
        Guid RelationshipId,
        Guid SubjectEmployeeId,
        Guid ManagerEmployeeId,
        Guid SubjectWorkAssignmentId,
        Guid ManagerWorkAssignmentId,
        ReportingRelationshipType Type,
        DateTime EffectiveFrom);

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
        var employeeIdsInScope = employees.Select(employee => employee.Id).ToArray();

        var activeEmployments = await dbContext.Employments.AsNoTracking()
            .Where(employment => employeeIdsInScope.Contains(employment.EmployeeId)
                && employment.EffectiveFrom <= at
                && (employment.EffectiveTo == null || at < employment.EffectiveTo))
            .Select(employment => new
            {
                employment.EmployeeId,
                employment.Id,
                employment.EffectiveFrom
            })
            .ToListAsync(cancellationToken);

        var primaryWorkAssignments = await dbContext.WorkAssignments.AsNoTracking()
            .Where(w => employeeIdsInScope.Contains(w.EmployeeId)
                && w.IsPrimary
                && w.EffectiveFrom <= at
                && (w.EffectiveTo == null || at < w.EffectiveTo))
            .Select(w => new ActivePrimaryWorkAssignment(
                w.Id,
                w.EmploymentId,
                w.EmployeeId,
                w.OrgUnitId,
                w.EffectiveFrom))
            .ToListAsync(cancellationToken);

        var managerRelationships = await dbContext.ManagerRelationships.AsNoTracking()
            .Where(m => m.EffectiveFrom <= at && (m.EffectiveTo == null || at < m.EffectiveTo))
            .OrderByDescending(m => m.EffectiveFrom)
            .Select(m => new EffectiveManagerRelationship(
                m.Id,
                m.SubjectEmployeeId,
                m.ManagerEmployeeId,
                m.SubjectWorkAssignmentId,
                m.ManagerWorkAssignmentId,
                m.Type,
                m.EffectiveFrom))
            .ToListAsync(cancellationToken);

        var orgUnits = await dbContext.OrgUnits.AsNoTracking().ToListAsync(cancellationToken);
        var activeEmploymentCountByEmployee = activeEmployments
            .GroupBy(employment => employment.EmployeeId)
            .ToDictionary(group => group.Key, group => group.Count());
        var activeEmploymentIds = activeEmployments.Select(employment => employment.Id).ToHashSet();
        var primaryWorkAssignmentsByEmployee = primaryWorkAssignments
            .Where(assignment => activeEmploymentIds.Contains(assignment.EmploymentId))
            .ToList();

        var primaryAssignmentsByEmployee = primaryWorkAssignmentsByEmployee
            .GroupBy(assignment => assignment.EmployeeId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(assignment => assignment.EffectiveFrom).ToArray());
        var currentPrimaryAssignmentByEmployee = primaryAssignmentsByEmployee
            .Where(group => group.Value.Length == 1)
            .ToDictionary(group => group.Key, group => group.Value[0]);

        var orgUnitIdsByEmployee = primaryAssignmentsByEmployee.ToDictionary(
            group => group.Key,
            group => (IReadOnlyList<Guid>)group.Value
                .Select(assignment => assignment.OrgUnitId)
                .Distinct()
                .Order()
                .ToArray());

        var currentPrimaryAssignmentById = currentPrimaryAssignmentByEmployee.Values
            .ToDictionary(assignment => assignment.WorkAssignmentId);
        var managerRelationshipsBySubjectAssignment = managerRelationships
            .Where(relationship => currentPrimaryAssignmentById.ContainsKey(relationship.SubjectWorkAssignmentId))
            .GroupBy(relationship => relationship.SubjectWorkAssignmentId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(relationship => relationship.EffectiveFrom).ToArray());
        var primaryManagerByEmployee = currentPrimaryAssignmentByEmployee.ToDictionary(
            group => group.Key,
            group => ResolvePrimaryManager(group.Value, managerRelationshipsBySubjectAssignment, currentPrimaryAssignmentByEmployee));
        var candidatesByEmployee = currentPrimaryAssignmentByEmployee.ToDictionary(
            group => group.Key,
            group => BuildRelationshipCandidates(group.Key, group.Value, managerRelationshipsBySubjectAssignment));

        var parentByOrgUnit = orgUnits.ToDictionary(orgUnit => orgUnit.Id, orgUnit => orgUnit.ParentId);

        var members = employees.Select(employee =>
        {
            var isActive = activeEmploymentCountByEmployee.GetValueOrDefault(employee.Id) > 0;
            var chain = BuildPrimaryManagementChain(employee.Id, currentPrimaryAssignmentByEmployee, primaryManagerByEmployee, out var hasCycle);
            var orgUnitIds = orgUnitIdsByEmployee.GetValueOrDefault(employee.Id, []);
            var ancestorOrgUnitIds = GetAncestorOrgUnitIds(orgUnitIds, parentByOrgUnit, out var hasOrgCycle);
            var primaryAssignmentCount = primaryAssignmentsByEmployee.GetValueOrDefault(employee.Id, []).Length;
            var remediationCodes = GetRemediationCodes(
                isActive,
                primaryAssignmentCount,
                hasCycle,
                hasOrgCycle);

            return new CampaignWorkforceMember(
                employee.Id,
                isActive,
                orgUnitIds,
                primaryManagerByEmployee.GetValueOrDefault(employee.Id),
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
            changes.Add("PrimaryOrgAssignmentChanged");
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
        int primaryWorkAssignmentCount,
        bool hasPrimaryManagementCycle,
        bool hasOrgUnitCycle)
    {
        var codes = new List<string>();
        if (!isActive)
            codes.Add("InactiveEmployee");
        if (primaryWorkAssignmentCount == 0)
            codes.Add("MissingPrimaryWorkAssignment");
        if (primaryWorkAssignmentCount > 1)
            codes.Add("ConflictingPrimaryWorkAssignments");
        if (hasPrimaryManagementCycle)
            codes.Add("PrimaryManagementCycle");
        if (hasOrgUnitCycle)
            codes.Add("OrgUnitHierarchyCycle");
        return codes;
    }

    private static Guid? ResolvePrimaryManager(
        ActivePrimaryWorkAssignment assignment,
        IReadOnlyDictionary<Guid, EffectiveManagerRelationship[]> managerRelationshipsBySubjectAssignment,
        IReadOnlyDictionary<Guid, ActivePrimaryWorkAssignment> currentPrimaryAssignmentByEmployee)
    {
        if (!managerRelationshipsBySubjectAssignment.TryGetValue(assignment.WorkAssignmentId, out var relationships))
            return null;

        var primaryRelationship = relationships.FirstOrDefault(relationship =>
            relationship.Type == ReportingRelationshipType.PrimaryManager
            && currentPrimaryAssignmentByEmployee.TryGetValue(relationship.ManagerEmployeeId, out var managerAssignment)
            && managerAssignment.WorkAssignmentId == relationship.ManagerWorkAssignmentId);

        return primaryRelationship?.ManagerEmployeeId;
    }

    private static IReadOnlyList<CampaignRelationshipCandidate> BuildRelationshipCandidates(
        Guid employeeId,
        ActivePrimaryWorkAssignment assignment,
        IReadOnlyDictionary<Guid, EffectiveManagerRelationship[]> managerRelationshipsBySubjectAssignment)
    {
        if (!managerRelationshipsBySubjectAssignment.TryGetValue(assignment.WorkAssignmentId, out var relationships))
            return [];

        return relationships
            .Where(relationship => relationship.Type != ReportingRelationshipType.PrimaryManager)
            .OrderBy(relationship => relationship.Type)
            .ThenBy(relationship => relationship.ManagerEmployeeId)
            .Select(relationship => new CampaignRelationshipCandidate(
                relationship.RelationshipId,
                employeeId,
                relationship.ManagerEmployeeId,
                relationship.Type,
                relationship.SubjectWorkAssignmentId,
                relationship.ManagerWorkAssignmentId,
                "CoreManagerRelationship"))
            .ToArray();
    }

    private static IReadOnlyList<Guid> BuildPrimaryManagementChain(
        Guid employeeId,
        IReadOnlyDictionary<Guid, ActivePrimaryWorkAssignment> currentPrimaryAssignmentByEmployee,
        IReadOnlyDictionary<Guid, Guid?> primaryManagerByEmployee,
        out bool hasCycle)
    {
        var chain = new List<Guid>();
        var visited = new HashSet<Guid> { employeeId };
        var current = employeeId;
        hasCycle = false;

        while (currentPrimaryAssignmentByEmployee.ContainsKey(current)
            && primaryManagerByEmployee.TryGetValue(current, out var managerId)
            && managerId.HasValue)
        {
            if (!visited.Add(managerId.Value))
            {
                hasCycle = true;
                break;
            }

            chain.Add(managerId.Value);
            current = managerId.Value;
        }

        return chain;
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
