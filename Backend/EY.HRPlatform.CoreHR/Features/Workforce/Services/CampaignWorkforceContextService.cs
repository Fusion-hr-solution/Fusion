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
    uint EmployeeVersion);

public sealed record CampaignWorkforceContext(
    DateTime AsOf,
    string SourceVersion,
    IReadOnlyList<CampaignWorkforceMember> Members);

public interface ICampaignWorkforceContextService
{
    Task<CampaignWorkforceContext> GetAsync(DateTime asOf, CancellationToken cancellationToken = default);
    Task<CampaignWorkforceContext> GetDeltaAsync(DateTime asOf, string baselineSourceVersion, CancellationToken cancellationToken = default);
}

/// <summary>
/// Core's campaign contract. It returns effective-dated workforce facts only; it does
/// not decide who may operate a Performance workflow.
/// </summary>
public sealed class CampaignWorkforceContextService(CoreHRDbContext dbContext) : ICampaignWorkforceContextService
{
    public async Task<CampaignWorkforceContext> GetAsync(DateTime asOf, CancellationToken cancellationToken = default)
    {
        var at = asOf.Kind == DateTimeKind.Utc ? asOf : asOf.ToUniversalTime();
        var employees = await dbContext.Employees.AsNoTracking().OrderBy(employee => employee.Id).ToListAsync(cancellationToken);
        var memberships = await dbContext.EmployeeOrgMemberships.AsNoTracking()
            .Where(membership => membership.EffectiveFrom <= at && (!membership.EffectiveTo.HasValue || membership.EffectiveTo > at))
            .ToListAsync(cancellationToken);
        var relationships = await dbContext.EmployeeReportingRelationships.AsNoTracking()
            .Where(relationship => relationship.Type == ReportingRelationshipType.PrimaryManager &&
                relationship.EffectiveFrom <= at && (!relationship.EffectiveTo.HasValue || relationship.EffectiveTo > at))
            .OrderByDescending(relationship => relationship.EffectiveFrom)
            .ToListAsync(cancellationToken);

        var primaryManagers = relationships
            .GroupBy(relationship => relationship.SubjectEmployeeId)
            .ToDictionary(group => group.Key, group => group.First().ManagerEmployeeId);
        var membershipsByEmployee = memberships.GroupBy(membership => membership.EmployeeId)
            .ToDictionary(group => group.Key, group => group.Select(membership => membership.OrgUnitId).Distinct().Order().ToArray());

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

            return new CampaignWorkforceMember(
                employee.Id,
                employee.Status == EmployeeStatus.Active,
                membershipsByEmployee.GetValueOrDefault(employee.Id, []),
                primaryManagers.GetValueOrDefault(employee.Id),
                chain,
                hasCycle,
                employee.Version);
        }).ToArray();

        return new CampaignWorkforceContext(at, ComputeSourceVersion(at, members), members);
    }

    public async Task<CampaignWorkforceContext> GetDeltaAsync(DateTime asOf, string baselineSourceVersion, CancellationToken cancellationToken = default)
    {
        var current = await GetAsync(asOf, cancellationToken);
        return string.Equals(current.SourceVersion, baselineSourceVersion, StringComparison.Ordinal)
            ? current with { Members = [] }
            : current;
    }

    private static string ComputeSourceVersion(DateTime at, IReadOnlyList<CampaignWorkforceMember> members)
    {
        var projection = string.Join('|', members.Select(member => string.Join(':', member.EmployeeId, member.IsActive,
            string.Join(',', member.OrgUnitIds), member.PrimaryManagerEmployeeId, string.Join(',', member.PrimaryManagementChain),
            member.HasPrimaryChainCycle, member.EmployeeVersion)));
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"{at:O}|{projection}")));
    }
}
