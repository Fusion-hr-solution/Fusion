namespace EY.HRPlatform.Identity.Features.TenantContext.Dtos;

public sealed record TenantSummaryDto(
    Guid TenantId,
    string Name,
    string Slug,
    string OperationalStatus,
    bool IsActive,
    bool IsArchived);
