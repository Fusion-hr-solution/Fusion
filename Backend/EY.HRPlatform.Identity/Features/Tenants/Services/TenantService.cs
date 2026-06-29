using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.Tenants.Dtos;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.Tenants.Services;

public interface ITenantService
{
    Task<TenantDto> CreateAsync(CreateTenantRequest request, CancellationToken cancellationToken = default);
    Task<TenantDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TenantDto>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default);
    Task<TenantDto?> UpdateAsync(Guid id, UpdateTenantRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeactivateAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> ReactivateAsync(Guid id, CancellationToken cancellationToken = default);
}

public class TenantService : ITenantService
{
    private readonly AppIdentityDbContext _dbContext;

    public TenantService(AppIdentityDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TenantDto> CreateAsync(CreateTenantRequest request, CancellationToken cancellationToken = default)
    {
        var tenant = Tenant.Create(request.Name);
        
        _dbContext.Tenants.Add(tenant);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(tenant);
    }

    public async Task<TenantDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var tenant = await _dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        return tenant is null ? null : ToDto(tenant);
    }

    public async Task<IReadOnlyList<TenantDto>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Tenants.AsNoTracking();

        if (!includeInactive)
            query = query.Where(t => t.IsActive);

        var tenants = await query
            .OrderBy(t => t.Name)
            .ToListAsync(cancellationToken);

        return tenants.Select(ToDto).ToList();
    }

    public async Task<TenantDto?> UpdateAsync(Guid id, UpdateTenantRequest request, CancellationToken cancellationToken = default)
    {
        var tenant = await _dbContext.Tenants
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (tenant is null)
            return null;

        tenant.Update(request.Name);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(tenant);
    }

    public async Task<bool> DeactivateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var tenant = await _dbContext.Tenants
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (tenant is null)
            return false;

        tenant.Deactivate();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> ReactivateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var tenant = await _dbContext.Tenants
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (tenant is null)
            return false;

        tenant.Reactivate();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static TenantDto ToDto(Tenant tenant) => new(
        tenant.Id,
        tenant.Name,
        tenant.Slug,
        tenant.IsActive,
        tenant.CreatedAt,
        tenant.UpdatedAt
    );
}
