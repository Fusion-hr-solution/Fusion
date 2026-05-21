using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class EmployeeImportFollowUpIssue : BaseEntity, ITenantEntity
{
    private EmployeeImportFollowUpIssue() { }

    public Guid TenantId { get; private set; }

    public uint Version { get; private set; }

    public Guid EmployeeImportHistoryId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public int SourceRowNumber { get; private set; }

    public string IssueCode { get; private set; } = string.Empty;

    public string? FieldKey { get; private set; }

    public static EmployeeImportFollowUpIssue Create(
        Guid tenantId,
        Guid employeeImportHistoryId,
        Guid employeeId,
        int sourceRowNumber,
        string issueCode,
        string? fieldKey)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (employeeImportHistoryId == Guid.Empty)
            throw new ArgumentException("EmployeeImportHistoryId cannot be empty.", nameof(employeeImportHistoryId));

        if (employeeId == Guid.Empty)
            throw new ArgumentException("EmployeeId cannot be empty.", nameof(employeeId));

        if (sourceRowNumber <= 0)
            throw new ArgumentOutOfRangeException(nameof(sourceRowNumber));

        if (string.IsNullOrWhiteSpace(issueCode))
            throw new ArgumentException("IssueCode cannot be empty.", nameof(issueCode));

        return new EmployeeImportFollowUpIssue
        {
            TenantId = tenantId,
            EmployeeImportHistoryId = employeeImportHistoryId,
            EmployeeId = employeeId,
            SourceRowNumber = sourceRowNumber,
            IssueCode = issueCode.Trim(),
            FieldKey = string.IsNullOrWhiteSpace(fieldKey) ? null : fieldKey.Trim()
        };
    }
}