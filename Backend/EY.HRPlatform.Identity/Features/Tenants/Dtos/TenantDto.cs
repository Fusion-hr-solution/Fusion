namespace EY.HRPlatform.Identity.Features.Tenants.Dtos;

public record TenantDto(
    Guid Id,
    string Name,
    string Slug,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
