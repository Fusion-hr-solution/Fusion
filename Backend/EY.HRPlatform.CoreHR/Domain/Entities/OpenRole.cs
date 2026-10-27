using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public enum OpenRoleStatus
{
    Open = 1,
    OnHold = 2,
    Filled = 3,
    Closed = 4,
}

/// <summary>
/// A role Core HR plans in the structure before anyone holds it: its title, the manager it reports to and its
/// unit. It shows on the org chart in that manager's line while it is open (or, for HR, on hold). Recruitment owns
/// hiring for it and may link its requisitions to it later.
/// </summary>
public sealed class OpenRole : BaseEntity, ITenantEntity
{
    public const int MaxJobTitleLength = 200;

    private OpenRole() { }

    public Guid TenantId { get; private set; }
    public string JobTitle { get; private set; } = string.Empty;
    public Guid ManagerEmployeeId { get; private set; }
    public Guid OrgUnitId { get; private set; }

    /// <summary>When the new person should start; null when not set yet.</summary>
    public DateOnly? TargetStartDate { get; private set; }

    public OpenRoleStatus Status { get; private set; }

    /// <summary>Filled and Closed take the role off the chart.</summary>
    public bool IsActive => Status is OpenRoleStatus.Open or OpenRoleStatus.OnHold;

    public static OpenRole Create(
        Guid tenantId,
        string jobTitle,
        Guid managerEmployeeId,
        Guid orgUnitId,
        DateOnly? targetStartDate,
        OpenRoleStatus status,
        string? actor)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.");
        if (status is not (OpenRoleStatus.Open or OpenRoleStatus.OnHold))
            throw new ArgumentException("A new role is open or on hold.");

        var role = new OpenRole { TenantId = tenantId, Status = status, CreatedBy = actor };
        role.Set(jobTitle, managerEmployeeId, orgUnitId, targetStartDate);
        return role;
    }

    public void Update(
        string jobTitle,
        Guid managerEmployeeId,
        Guid orgUnitId,
        DateOnly? targetStartDate,
        OpenRoleStatus status,
        string? actor)
    {
        if (!Enum.IsDefined(status))
            throw new ArgumentException("Unknown status.");

        Set(jobTitle, managerEmployeeId, orgUnitId, targetStartDate);
        Status = status;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Set(string jobTitle, Guid managerEmployeeId, Guid orgUnitId, DateOnly? targetStartDate)
    {
        var title = jobTitle?.Trim() ?? string.Empty;
        if (title.Length == 0 || title.Length > MaxJobTitleLength)
            throw new ArgumentException("Job title is required and at most 200 characters.");
        if (managerEmployeeId == Guid.Empty || orgUnitId == Guid.Empty)
            throw new ArgumentException("Manager and unit are required.");

        JobTitle = title;
        ManagerEmployeeId = managerEmployeeId;
        OrgUnitId = orgUnitId;
        TargetStartDate = targetStartDate;
    }
}
