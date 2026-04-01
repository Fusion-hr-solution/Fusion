namespace EY.HRPlatform.Identity.Features.Tenants.Dtos;

public record TenantDto(
    Guid Id,
    string Name,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
