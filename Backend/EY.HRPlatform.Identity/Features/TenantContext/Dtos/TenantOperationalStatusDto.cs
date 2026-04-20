namespace EY.HRPlatform.Identity.Features.TenantContext.Dtos;

public sealed record TenantOperationalStatusDto(
    Guid TenantId,
    string OperationalStatus,
    bool IsActive,
    bool IsArchived);