using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Domain.ValueObjects;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Canonical, effective-dated, tenant-scoped work assignment belonging to an <c>Employment</c>.
/// It is the ONLY source of an employee's organization context (via <see cref="OrgUnitId"/>),
/// plain-text job title, and optional work location. At most one active primary work assignment
/// exists per active employment; assignment dates must fit within the parent employment window.
/// </summary>
public sealed class WorkAssignment : AggregateRoot, ITenantEntity
{
    private WorkAssignment() { }

    public Guid TenantId { get; private set; }
    public Guid EmploymentId { get; private set; }

    /// <summary>
    /// Denormalized owning employee, copied from the parent employment, so that as-of resolvers
    /// and tenant indexes can answer "this employee's primary assignment" without a join.
    /// </summary>
    public Guid EmployeeId { get; private set; }

    public Guid OrgUnitId { get; private set; }

    /// <summary>Plain-text job title. Never a position identity (no Position model).</summary>
    public string JobTitle { get; private set; } = string.Empty;
    public string? WorkLocation { get; private set; }
    public bool IsPrimary { get; private set; }

    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveTo { get; private set; }

    public WorkforceSourceType Source { get; private set; }
    public string? SourceReference { get; private set; }
    public Guid? ImportBatchId { get; private set; }

    public EffectiveDateRange Interval => EffectiveDateRange.Create(EffectiveFrom, EffectiveTo);
    public bool IsActiveOn(DateTime asOf) => Interval.IsActiveOn(asOf);

    public static WorkAssignment Create(
        Guid tenantId,
        Guid employmentId,
        Guid employeeId,
        Guid orgUnitId,
        string jobTitle,
        string? workLocation,
        bool isPrimary,
        DateTime effectiveFrom,
        DateTime? effectiveTo,
        WorkforceSourceType source,
        string? sourceReference = null,
        Guid? importBatchId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (employmentId == Guid.Empty)
            throw new ArgumentException("Employment id is required.", nameof(employmentId));
        if (employeeId == Guid.Empty)
            throw new ArgumentException("Employee id is required.", nameof(employeeId));
        if (orgUnitId == Guid.Empty)
            throw new ArgumentException("Organization unit is required.", nameof(orgUnitId));

        var interval = EffectiveDateRange.Create(effectiveFrom, effectiveTo);

        return new WorkAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmploymentId = employmentId,
            EmployeeId = employeeId,
            OrgUnitId = orgUnitId,
            JobTitle = NormalizeJobTitle(jobTitle),
            WorkLocation = NormalizeWorkLocation(workLocation),
            IsPrimary = isPrimary,
            EffectiveFrom = interval.EffectiveFrom,
            EffectiveTo = interval.EffectiveTo,
            Source = source,
            SourceReference = sourceReference?.Trim(),
            ImportBatchId = importBatchId,
        };
    }

    /// <summary>Closes this assignment effective the given date (close-and-succeed convention).</summary>
    public void End(DateTime effectiveDate)
    {
        var closed = Interval.CloseAt(effectiveDate);
        EffectiveTo = closed.EffectiveTo;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(Guid orgUnitId, string jobTitle, string? workLocation)
    {
        if (orgUnitId == Guid.Empty)
            throw new ArgumentException("Organization unit is required.", nameof(orgUnitId));

        OrgUnitId = orgUnitId;
        JobTitle = NormalizeJobTitle(jobTitle);
        WorkLocation = NormalizeWorkLocation(workLocation);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeJobTitle(string jobTitle)
    {
        if (string.IsNullOrWhiteSpace(jobTitle))
            throw new ArgumentException("Job title is required.", nameof(jobTitle));

        var normalized = jobTitle.Trim();
        if (normalized.Length > 150)
            throw new ArgumentException("Job title cannot exceed 150 characters.", nameof(jobTitle));

        return normalized;
    }

    private static string? NormalizeWorkLocation(string? workLocation)
    {
        if (string.IsNullOrWhiteSpace(workLocation))
            return null;

        var normalized = workLocation.Trim();
        if (normalized.Length > 100)
            throw new ArgumentException("Work location cannot exceed 100 characters.", nameof(workLocation));

        return normalized;
    }
}
