using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Setup.Dtos;

public sealed record SetupStateDto(
    Guid Id,
    Guid TenantId,
    SetupStatus Status,
    bool OrgUnitsConfigured,
    bool EmployeesImported,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);
