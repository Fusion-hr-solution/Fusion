using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;

public interface IPlatformOrganizationService
{
    Task<PlatformOrganizationPagedListDto> ListAsync(
        PlatformOrganizationListQueryDto query,
        CancellationToken cancellationToken = default);
    Task<PlatformOrganizationDetailDto?> GetAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<PlatformOrganizationCreatedDto> CreateAsync(
        CreatePlatformOrganizationRequest request,
        Guid createdByUserId,
        CancellationToken cancellationToken = default);
    Task<bool> SuspendAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool> ReactivateAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool> ArchiveAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<PlatformOrganizationInviteStatusDto?> ResendFirstAdminInviteAsync(
        Guid tenantId,
        Guid platformAdminUserId,
        CancellationToken cancellationToken = default);
    Task<bool> RevokePendingFirstAdminInvitesAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<PlatformOrganizationDetailDto?> UpdateAsync(Guid tenantId, UpdatePlatformOrganizationRequest request, CancellationToken cancellationToken = default);
}

public sealed class PlatformOrganizationService(
    AppIdentityDbContext db,
    IConfiguration configuration) : IPlatformOrganizationService
{
    public async Task<PlatformOrganizationPagedListDto> ListAsync(
        PlatformOrganizationListQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var skip = Math.Max(0, query.Skip);
        var take = Math.Clamp(query.Take, 1, 100);

        var orderDirection = query.OrderDirection?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true
            ? "asc"
            : "desc";

        var search = query.Search?.Trim();
        var searchLower = string.IsNullOrWhiteSpace(search)
            ? null
            : search.ToLowerInvariant();

        var allowedFilter =
            query.FilterByStatus?.Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Load ALL tenants for global stats (unfiltered by search)
        var allTenants = await db.Tenants.AsNoTracking().ToListAsync(cancellationToken);
        var allIds = allTenants.Select(t => t.Id).ToList();
        var allMetrics = await LoadMetricsAsync(allIds, cancellationToken);
        var allSummaries = allTenants.Select(t => MapSummary(t, allMetrics)).ToList();

        // Compute global stats from full DB (before any filters)
        var stats = new PlatformOrganizationStatsDto
        {
            TotalOrganizations = allSummaries.Count,
            InvitedPending = allSummaries.Count(s =>
                s.OperationalStatus.Equals(OrganizationOperationalStatus.Invited, StringComparison.OrdinalIgnoreCase)),
            ActiveOrganizations = allSummaries.Count(s =>
                s.OperationalStatus.Equals(OrganizationOperationalStatus.Active, StringComparison.OrdinalIgnoreCase))
        };

        // Apply search filter for paginated list
        var tenants = searchLower is not null
            ? allTenants.Where(t => t.Name.ToLower().Contains(searchLower)).ToList()
            : allTenants;
        var metrics = allMetrics;

        var summaries = tenants.Select(t => MapSummary(t, metrics)).ToList();

        if (allowedFilter is not null && allowedFilter.Count > 0)
            summaries = summaries
                .Where(s => allowedFilter.Contains(s.OperationalStatus))
                .ToList();

        static int StatusPriority(string operationalStatus) => operationalStatus switch
        {
            OrganizationOperationalStatus.Archived => 0,
            OrganizationOperationalStatus.Suspended => 1,
            OrganizationOperationalStatus.Draft => 2,
            OrganizationOperationalStatus.Invited => 3,
            OrganizationOperationalStatus.Active => 4,
            _ => -1
        };

        IOrderedEnumerable<PlatformOrganizationSummaryDto> ordered;
        switch (query.OrderBy)
        {
            case "name":
                ordered = orderDirection == "asc"
                    ? summaries.OrderBy(s => s.Name)
                    : summaries.OrderByDescending(s => s.Name);
                break;
            case "createdAt":
                ordered = orderDirection == "asc"
                    ? summaries.OrderBy(s => s.CreatedAt)
                    : summaries.OrderByDescending(s => s.CreatedAt);
                break;
            case "operationalStatus":
                ordered = orderDirection == "asc"
                    ? summaries.OrderBy(s => StatusPriority(s.OperationalStatus))
                    : summaries.OrderByDescending(s => StatusPriority(s.OperationalStatus));
                break;
            case "activeUserCount":
                ordered = orderDirection == "asc"
                    ? summaries.OrderBy(s => s.ActiveUserCount)
                    : summaries.OrderByDescending(s => s.ActiveUserCount);
                break;
            case "pendingInviteCount":
                ordered = orderDirection == "asc"
                    ? summaries.OrderBy(s => s.PendingInviteCount)
                    : summaries.OrderByDescending(s => s.PendingInviteCount);
                break;
            case "lastActivityAt":
                ordered = orderDirection == "asc"
                    ? summaries.OrderBy(s => s.LastActivityAt)
                    : summaries.OrderByDescending(s => s.LastActivityAt);
                break;
            default:
                ordered = summaries.OrderByDescending(s => s.CreatedAt);
                break;
        }

        var totalCount = ordered.Count();
        var items = ordered.Skip(skip).Take(take).ToList();

        return new PlatformOrganizationPagedListDto
        {
            Items = items,
            TotalCount = totalCount,
            Stats = stats
        };
    }

    public async Task<PlatformOrganizationDetailDto?> GetAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (tenant is null)
            return null;

        var metrics = await LoadMetricsAsync([tenantId], cancellationToken);
        var primaryEmail = await GetPrimaryHrAdminEmailAsync(tenantId, cancellationToken);
        return MapDetail(tenant, metrics, primaryEmail);
    }

    public async Task<PlatformOrganizationCreatedDto> CreateAsync(
        CreatePlatformOrganizationRequest request,
        Guid createdByUserId,
        CancellationToken cancellationToken = default)
    {
        // EF InMemory doesn't support transactions; skip them in tests.
        IDbContextTransaction? tx = null;
        try
        {
            tx = await db.Database.BeginTransactionAsync(cancellationToken);
        }
        catch (InvalidOperationException)
        {
            tx = null;
        }
        try
        {
            var tenant = Tenant.Create(request.Name.Trim());
            if (!string.IsNullOrWhiteSpace(request.InternalNotes))
                tenant.SetInternalNotes(request.InternalNotes);

            db.Tenants.Add(tenant);
            await db.SaveChangesAsync(cancellationToken);

            var normalizedEmail = request.FirstAdminEmail.Trim().ToLowerInvariant();
            var existingUser = await db.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail.ToUpperInvariant(), cancellationToken);
            if (existingUser)
                throw new InvalidOperationException("That email is already registered to a user.");

            var pendingDup = await db.InviteTokens.AnyAsync(
                i => i.TenantId == tenant.Id && i.Email == normalizedEmail && i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow,
                cancellationToken);
            if (pendingDup)
                throw new InvalidOperationException("A pending invitation already exists for this email.");

            var invite = InviteToken.Create(
                normalizedEmail,
                tenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                request.FirstAdminFirstName,
                request.FirstAdminLastName);

            db.InviteTokens.Add(invite);
            await db.SaveChangesAsync(cancellationToken);
            if (tx is not null)
                await tx.CommitAsync(cancellationToken);

            var detail = await GetAsync(tenant.Id, cancellationToken)
                         ?? throw new InvalidOperationException("Failed to load created organization.");

            var link = BuildInviteLink(invite.Token);
            return new PlatformOrganizationCreatedDto
            {
                Organization = detail,
                InviteLink = link
            };
        }
        catch
        {
            if (tx is not null)
                await tx.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (tx is not null)
                await tx.DisposeAsync();
        }
    }

    public async Task<bool> SuspendAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
            return false;
        tenant.Deactivate();
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ReactivateAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
            return false;
        tenant.Reactivate();
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ArchiveAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
            return false;
        tenant.Archive();
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PlatformOrganizationInviteStatusDto?> ResendFirstAdminInviteAsync(
        Guid tenantId,
        Guid platformAdminUserId,
        CancellationToken cancellationToken = default)
    {
        _ = platformAdminUserId;

        var invite = await db.InviteTokens
            .Where(i => i.TenantId == tenantId && i.Role == PlatformRole.HRAdmin && i.AcceptedAt == null)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (invite is null)
            return null;

        invite.ExtendExpiry();
        await db.SaveChangesAsync(cancellationToken);

        return new PlatformOrganizationInviteStatusDto
        {
            InviteId = invite.Id,
            Status = "pending",
            Email = invite.Email,
            SentAt = invite.CreatedAt,
            ExpiresAt = invite.ExpiresAt,
            InviteLink = BuildInviteLink(invite.Token)
        };
    }

    public async Task<bool> RevokePendingFirstAdminInvitesAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var pending = await db.InviteTokens
            .Where(i => i.TenantId == tenantId && i.Role == PlatformRole.HRAdmin && i.AcceptedAt == null)
            .ToListAsync(cancellationToken);

        if (pending.Count == 0)
            return false;

        db.InviteTokens.RemoveRange(pending);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PlatformOrganizationDetailDto?> UpdateAsync(
        Guid tenantId,
        UpdatePlatformOrganizationRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
            return null;

        if (request.Name is not null)
            tenant.Update(request.Name);

        if (request.InternalNotes is not null)
            tenant.SetInternalNotes(request.InternalNotes);

        await db.SaveChangesAsync(cancellationToken);

        var metrics = await LoadMetricsAsync([tenantId], cancellationToken);
        var primaryEmail = await GetPrimaryHrAdminEmailAsync(tenantId, cancellationToken);
        return MapDetail(tenant, metrics, primaryEmail);
    }

    private string BuildInviteLink(string token)
    {
        var publicBase = configuration["Application:PublicBaseUrl"] ?? "http://localhost:3000";
        var path = configuration["Application:InviteAcceptPath"] ?? "/core/invite/accept";
        publicBase = publicBase.TrimEnd('/');
        if (!path.StartsWith('/'))
            path = "/" + path;
        return $"{publicBase}{path}?token={Uri.EscapeDataString(token)}";
    }

    private async Task<string?> GetPrimaryHrAdminEmailAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var hrAdminRoleId = await db.Roles.AsNoTracking()
            .Where(r => r.Name == PlatformRole.HRAdmin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (hrAdminRoleId == Guid.Empty)
            return null;

        var userId = await (from u in db.Users.AsNoTracking()
                join ur in db.UserRoles.AsNoTracking() on u.Id equals ur.UserId
                where u.TenantId == tenantId && ur.RoleId == hrAdminRoleId
                select (Guid?)u.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!userId.HasValue)
            return null;

        return await db.Users.AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => u.Email)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private sealed class TenantMetrics
    {
        public int ActiveUserCount { get; init; }
        public int PendingInviteCount { get; init; }
        public bool HasHrAdminUser { get; init; }
        public List<InviteToken> HrInvites { get; init; } = [];
        public DateTime? LastActivityAt { get; init; }
    }

    private async Task<Dictionary<Guid, TenantMetrics>> LoadMetricsAsync(
        List<Guid> tenantIds,
        CancellationToken cancellationToken)
    {
        var hrAdminRoleId = await db.Roles.AsNoTracking()
            .Where(r => r.Name == PlatformRole.HRAdmin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var usersInTenants = await db.Users.AsNoTracking()
            .Where(u => tenantIds.Contains(u.TenantId) && u.IsActive)
            .Select(u => new { u.TenantId, u.Id, u.LastLoginAt })
            .ToListAsync(cancellationToken);

        var userCounts = usersInTenants.GroupBy(u => u.TenantId).ToDictionary(g => g.Key, g => g.Count());

        var tenantUserIds = usersInTenants.Select(u => u.Id).ToHashSet();
        HashSet<Guid> hrAdminUserIds = [];
        if (hrAdminRoleId != Guid.Empty && tenantUserIds.Count > 0)
        {
            hrAdminUserIds = (await db.UserRoles.AsNoTracking()
                    .Where(ur => tenantUserIds.Contains(ur.UserId) && ur.RoleId == hrAdminRoleId)
                    .Select(ur => ur.UserId)
                    .ToListAsync(cancellationToken))
                .ToHashSet();
        }

        var hasHrAdminByTenant = usersInTenants
            .Where(u => hrAdminUserIds.Contains(u.Id))
            .Select(u => u.TenantId)
            .Distinct()
            .ToHashSet();

        var hrInvitesByTenant = await db.InviteTokens.AsNoTracking()
            .Where(i => tenantIds.Contains(i.TenantId) && i.Role == PlatformRole.HRAdmin)
            .ToListAsync(cancellationToken);

        var pendingByTenant = hrInvitesByTenant
            .Where(i => i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .GroupBy(i => i.TenantId)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = new Dictionary<Guid, TenantMetrics>();
        foreach (var tid in tenantIds)
        {
            userCounts.TryGetValue(tid, out var uc);
            pendingByTenant.TryGetValue(tid, out var pc);
            var invites = hrInvitesByTenant.Where(i => i.TenantId == tid).ToList();
            var lastUser = usersInTenants.Where(u => u.TenantId == tid).ToList();
            DateTime? lastLogin = lastUser.Count == 0
                ? null
                : lastUser.Max(u => u.LastLoginAt);

            result[tid] = new TenantMetrics
            {
                ActiveUserCount = uc,
                PendingInviteCount = pc,
                HasHrAdminUser = hasHrAdminByTenant.Contains(tid),
                HrInvites = invites,
                LastActivityAt = lastLogin
            };
        }

        return result;
    }

    private static PlatformOrganizationSummaryDto MapSummary(
        Tenant tenant,
        IReadOnlyDictionary<Guid, TenantMetrics> metrics)
    {
        metrics.TryGetValue(tenant.Id, out var m);
        m ??= new TenantMetrics();

        var status = ComputeOperationalStatus(tenant, m);
        return new PlatformOrganizationSummaryDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            OperationalStatus = status,
            ActiveUserCount = m.ActiveUserCount,
            PendingInviteCount = m.PendingInviteCount,
            CreatedAt = tenant.CreatedAt,
            LastActivityAt = m.LastActivityAt,
            IsActive = tenant.IsActive,
            IsArchived = tenant.IsArchived
        };
    }

    private PlatformOrganizationDetailDto MapDetail(
        Tenant tenant,
        IReadOnlyDictionary<Guid, TenantMetrics> metrics,
        string? primaryAdminEmail)
    {
        metrics.TryGetValue(tenant.Id, out var m);
        m ??= new TenantMetrics();
        var status = ComputeOperationalStatus(tenant, m);
        var inviteDto = BuildInviteStatus(m.HrInvites);

        return new PlatformOrganizationDetailDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            OperationalStatus = status,
            CreatedAt = tenant.CreatedAt,
            UpdatedAt = tenant.UpdatedAt,
            InternalNotes = tenant.InternalNotes,
            ActiveUserCount = m.ActiveUserCount,
            PendingInviteCount = m.PendingInviteCount,
            LastActivityAt = m.LastActivityAt,
            IsActive = tenant.IsActive,
            IsArchived = tenant.IsArchived,
            PrimaryAdminEmail = primaryAdminEmail,
            FirstAdminInvite = inviteDto
        };
    }

    private PlatformOrganizationInviteStatusDto BuildInviteStatus(List<InviteToken> hrInvites)
    {
        var accepted = hrInvites.FirstOrDefault(i => i.AcceptedAt != null);
        if (accepted != null)
        {
            return new PlatformOrganizationInviteStatusDto
            {
                InviteId = accepted.Id,
                Status = "accepted",
                Email = accepted.Email,
                SentAt = accepted.CreatedAt,
                ExpiresAt = accepted.ExpiresAt,
                InviteLink = null
            };
        }

        var pending = hrInvites
            .Where(i => i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefault();

        if (pending != null)
        {
            return new PlatformOrganizationInviteStatusDto
            {
                InviteId = pending.Id,
                Status = "pending",
                Email = pending.Email,
                SentAt = pending.CreatedAt,
                ExpiresAt = pending.ExpiresAt,
                InviteLink = BuildInviteLink(pending.Token)
            };
        }

        var expired = hrInvites
            .Where(i => i.AcceptedAt == null && i.ExpiresAt <= DateTime.UtcNow)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefault();

        if (expired != null)
        {
            return new PlatformOrganizationInviteStatusDto
            {
                InviteId = expired.Id,
                Status = "expired",
                Email = expired.Email,
                SentAt = expired.CreatedAt,
                ExpiresAt = expired.ExpiresAt,
                InviteLink = null
            };
        }

        return new PlatformOrganizationInviteStatusDto
        {
            InviteId = null,
            Status = "none",
            Email = null,
            SentAt = null,
            ExpiresAt = null,
            InviteLink = null
        };
    }

    private static string ComputeOperationalStatus(Tenant tenant, TenantMetrics m)
    {
        if (tenant.IsArchived)
            return OrganizationOperationalStatus.Archived;
        if (!tenant.IsActive)
            return OrganizationOperationalStatus.Suspended;
        if (m.HasHrAdminUser)
            return OrganizationOperationalStatus.Active;

        var hasPendingHrInvite = m.HrInvites.Any(i =>
            i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow);

        if (hasPendingHrInvite)
            return OrganizationOperationalStatus.Invited;

        if (m.HrInvites.Count == 0)
            return OrganizationOperationalStatus.Draft;

        // Has invites but all expired/failed — still in "invited" lifecycle stage
        return OrganizationOperationalStatus.Invited;
    }

}
