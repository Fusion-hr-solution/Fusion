using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;

public interface IPlatformOrganizationService
{
    Task<IReadOnlyList<PlatformOrganizationSummaryDto>> ListAsync(CancellationToken cancellationToken = default);
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
}

public sealed class PlatformOrganizationService(
    AppIdentityDbContext db,
    IConfiguration configuration) : IPlatformOrganizationService
{
    public async Task<IReadOnlyList<PlatformOrganizationSummaryDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var tenants = await db.Tenants.AsNoTracking()
            .OrderBy(t => t.Name)
            .ToListAsync(cancellationToken);

        if (tenants.Count == 0)
            return [];

        var ids = tenants.Select(t => t.Id).ToList();
        var metrics = await LoadMetricsAsync(ids, cancellationToken);

        return tenants.Select(t => MapSummary(t, metrics)).ToList();
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
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var tenant = Tenant.Create(request.Name.Trim());
            if (!string.IsNullOrWhiteSpace(request.InternalNotes))
                tenant.SetInternalNotes(request.InternalNotes);
            if (!string.IsNullOrWhiteSpace(request.PlanTier))
                tenant.SetPlanTier(request.PlanTier);

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
            await tx.RollbackAsync(cancellationToken);
            throw;
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

        var allInvitesForPending = await db.InviteTokens.AsNoTracking()
            .Where(i => tenantIds.Contains(i.TenantId))
            .ToListAsync(cancellationToken);

        var pendingByTenant = allInvitesForPending
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
            DateTime? lastInvite = invites.Count == 0
                ? null
                : invites.Max(i => i.CreatedAt);
            var lastActivity = MaxDate(lastLogin, lastInvite);

            result[tid] = new TenantMetrics
            {
                ActiveUserCount = uc,
                PendingInviteCount = pc,
                HasHrAdminUser = hasHrAdminByTenant.Contains(tid),
                HrInvites = invites,
                LastActivityAt = lastActivity
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
        var firstAdmin = ComputeFirstAdminStatus(tenant, m, status);
        return new PlatformOrganizationSummaryDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            OperationalStatus = status,
            FirstAdminStatus = firstAdmin,
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
        var firstAdmin = ComputeFirstAdminStatus(tenant, m, status);
        var inviteDto = BuildInviteStatus(m.HrInvites);

        return new PlatformOrganizationDetailDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            OperationalStatus = status,
            FirstAdminStatus = firstAdmin,
            CreatedAt = tenant.CreatedAt,
            UpdatedAt = tenant.UpdatedAt,
            InternalNotes = tenant.InternalNotes,
            PlanTier = tenant.PlanTier,
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

        return OrganizationOperationalStatus.Attention;
    }

    private static string ComputeFirstAdminStatus(Tenant tenant, TenantMetrics m, string operational)
    {
        if (operational == OrganizationOperationalStatus.Active)
            return "Verified";
        if (operational == OrganizationOperationalStatus.Invited)
            return "Awaiting acceptance";
        if (operational == OrganizationOperationalStatus.Draft)
            return "Not invited";
        if (operational == OrganizationOperationalStatus.Attention)
            return "Action required";
        if (operational == OrganizationOperationalStatus.Suspended)
            return "Suspended";
        if (operational == OrganizationOperationalStatus.Archived)
            return "Archived";
        return "Unknown";
    }

    private static DateTime? MaxDate(DateTime? a, DateTime? b)
    {
        if (!a.HasValue)
            return b;
        if (!b.HasValue)
            return a;
        return a.Value >= b.Value ? a : b;
    }
}
