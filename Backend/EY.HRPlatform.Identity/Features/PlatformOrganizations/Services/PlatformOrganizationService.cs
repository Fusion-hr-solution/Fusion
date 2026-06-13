using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
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
    /// <exception cref="InvalidOperationException">Tenant is in invalid state for this transition.</exception>
    Task<bool> SuspendAsync(Guid tenantId, CancellationToken cancellationToken = default);
    /// <exception cref="InvalidOperationException">Tenant is in invalid state for this transition.</exception>
    Task<bool> ReactivateAsync(Guid tenantId, CancellationToken cancellationToken = default);
    /// <exception cref="InvalidOperationException">Tenant is in invalid state for this transition.</exception>
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
                s.OperationalStatus.Equals(OrganizationOperationalStatus.Active, StringComparison.OrdinalIgnoreCase)),
            DraftOrganizations = allSummaries.Count(s =>
                s.OperationalStatus.Equals(OrganizationOperationalStatus.Draft, StringComparison.OrdinalIgnoreCase)),
            SuspendedOrganizations = allSummaries.Count(s =>
                s.OperationalStatus.Equals(OrganizationOperationalStatus.Suspended, StringComparison.OrdinalIgnoreCase)),
            ArchivedOrganizations = allSummaries.Count(s =>
                s.OperationalStatus.Equals(OrganizationOperationalStatus.Archived, StringComparison.OrdinalIgnoreCase))
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
        var primaryEmail = await GetPrimaryOrgAdminEmailAsync(tenantId, cancellationToken);
        return MapDetail(tenant, metrics, primaryEmail);
    }

    public async Task<PlatformOrganizationCreatedDto> CreateAsync(
        CreatePlatformOrganizationRequest request,
        Guid createdByUserId,
        CancellationToken cancellationToken = default)
    {
        IDbContextTransaction? tx = null;
        if (db.Database.IsRelational())
            tx = await db.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            // Generate unique slug from the name
            var baseSlug = Tenant.GenerateSlug(request.Name);
            var slug = baseSlug;
            var slugSuffix = 2;
            while (await db.Tenants.AnyAsync(t => t.Slug == slug, cancellationToken))
            {
                slug = $"{baseSlug}-{slugSuffix}";
                slugSuffix++;
            }

            var tenant = Tenant.Create(Guid.NewGuid(), request.Name.Trim(), slug);
            if (!string.IsNullOrWhiteSpace(request.InternalNotes))
                tenant.SetInternalNotes(request.InternalNotes);

            // Check for duplicate tenant name (case-insensitive, among non-archived)
            var normalizedName = tenant.Name.ToLowerInvariant();
            var nameExists = await db.Tenants.AnyAsync(
                t => t.Name.ToLower() == normalizedName && !t.IsArchived,
                cancellationToken);
            if (nameExists)
                throw new InvalidOperationException("An organization with this name already exists.");

            db.Tenants.Add(tenant);
            await db.SaveChangesAsync(cancellationToken);

            var normalizedEmail = request.FirstAdminEmail.Trim().ToLowerInvariant();
            var existingUser = await db.Users.IgnoreQueryFilters().AnyAsync(u => u.NormalizedEmail == normalizedEmail.ToUpperInvariant(), cancellationToken);
            if (existingUser)
                throw new InvalidOperationException("That email is already registered to a user.");

            var pendingDup = await db.InviteTokens.IgnoreQueryFilters().AnyAsync(
                i => i.TenantId == tenant.Id && i.Email == normalizedEmail && i.AcceptedAt == null && !i.IsRevoked && i.ExpiresAt > DateTime.UtcNow,
                cancellationToken);
            if (pendingDup)
                throw new InvalidOperationException("A pending invitation already exists for this email.");

            var invite = InviteToken.Create(
                normalizedEmail,
                tenant.Id,
                PlatformRole.OrgAdmin,
                createdByUserId,
                request.FirstAdminFirstName,
                request.FirstAdminLastName);

            db.InviteTokens.Add(invite);
            await db.SaveChangesAsync(cancellationToken);

            var link = BuildInviteLink(invite.Token);

            if (tx is not null)
                await tx.CommitAsync(cancellationToken);

            var detail = await GetAsync(tenant.Id, cancellationToken)
                         ?? throw new InvalidOperationException("Failed to load created organization.");

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
            .IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId && i.Role == PlatformRole.OrgAdmin && i.AcceptedAt == null && !i.IsRevoked)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (invite is null)
            return null;

        invite.ExtendExpiry();
        await db.SaveChangesAsync(cancellationToken);
        var link = BuildInviteLink(invite.Token);

        return new PlatformOrganizationInviteStatusDto
        {
            InviteId = invite.Id,
            Status = "pending",
            Email = invite.Email,
            SentAt = invite.CreatedAt,
            ExpiresAt = invite.ExpiresAt,
            InviteLink = link,
        };
    }

    public async Task<bool> RevokePendingFirstAdminInvitesAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var pending = await db.InviteTokens
            .IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId && i.Role == PlatformRole.OrgAdmin && i.AcceptedAt == null && !i.IsRevoked)
            .ToListAsync(cancellationToken);

        if (pending.Count == 0)
            return false;

        foreach (var invite in pending)
            invite.Revoke();

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
        {
            var normalizedName = request.Name.Trim().ToLowerInvariant();
            var nameExists = await db.Tenants.AnyAsync(
                t => t.Id != tenantId && t.Name.ToLower() == normalizedName && !t.IsArchived,
                cancellationToken);
            if (nameExists)
                throw new InvalidOperationException("An organization with this name already exists.");

            tenant.Update(request.Name);
        }

        if (request.InternalNotes is not null)
            tenant.SetInternalNotes(request.InternalNotes);

        await db.SaveChangesAsync(cancellationToken);

        var metrics = await LoadMetricsAsync([tenantId], cancellationToken);
        var primaryEmail = await GetPrimaryOrgAdminEmailAsync(tenantId, cancellationToken);
        return MapDetail(tenant, metrics, primaryEmail);
    }

    private string BuildInviteLink(string token)
        => InvitationLinkBuilder.Build(configuration, token);

    private async Task<string?> GetPrimaryOrgAdminEmailAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var orgAdminRoleId = await db.Roles.AsNoTracking()
            .Where(r => r.Name == PlatformRole.OrgAdmin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (orgAdminRoleId == Guid.Empty)
            return null;

        var userId = await (from u in db.Users.IgnoreQueryFilters().AsNoTracking()
                join ur in db.UserRoles.AsNoTracking() on u.Id equals ur.UserId
                where u.TenantId == tenantId && ur.RoleId == orgAdminRoleId
                select (Guid?)u.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!userId.HasValue)
            return null;

        return await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => u.Email)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private sealed class TenantMetrics
    {
        public int ActiveUserCount { get; init; }
        public int PendingInviteCount { get; init; }
        public bool HasOrgAdminUser { get; init; }
        public List<InviteToken> OrgAdminInvites { get; init; } = [];
        public DateTime? LastActivityAt { get; init; }
    }

    private async Task<Dictionary<Guid, TenantMetrics>> LoadMetricsAsync(
        List<Guid> tenantIds,
        CancellationToken cancellationToken)
    {
        var orgAdminRoleId = await db.Roles.AsNoTracking()
            .Where(r => r.Name == PlatformRole.OrgAdmin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var usersInTenants = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => tenantIds.Contains(u.TenantId) && u.IsActive)
            .Select(u => new { u.TenantId, u.Id, u.LastLoginAt })
            .ToListAsync(cancellationToken);

        var userCounts = usersInTenants.GroupBy(u => u.TenantId).ToDictionary(g => g.Key, g => g.Count());

        var tenantUserIds = usersInTenants.Select(u => u.Id).ToHashSet();
        HashSet<Guid> orgAdminUserIds = [];
        if (orgAdminRoleId != Guid.Empty && tenantUserIds.Count > 0)
        {
            orgAdminUserIds = (await db.UserRoles.AsNoTracking()
                    .Where(ur => tenantUserIds.Contains(ur.UserId) && ur.RoleId == orgAdminRoleId)
                    .Select(ur => ur.UserId)
                    .ToListAsync(cancellationToken))
                .ToHashSet();
        }

        var hasOrgAdminByTenant = usersInTenants
            .Where(u => orgAdminUserIds.Contains(u.Id))
            .Select(u => u.TenantId)
            .Distinct()
            .ToHashSet();

        var orgAdminInvitesByTenant = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .Where(i => tenantIds.Contains(i.TenantId) && i.Role == PlatformRole.OrgAdmin && !i.IsRevoked)
            .ToListAsync(cancellationToken);

        var pendingByTenant = orgAdminInvitesByTenant
            .Where(i => i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .GroupBy(i => i.TenantId)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = new Dictionary<Guid, TenantMetrics>();
        foreach (var tid in tenantIds)
        {
            userCounts.TryGetValue(tid, out var uc);
            pendingByTenant.TryGetValue(tid, out var pc);
            var invites = orgAdminInvitesByTenant.Where(i => i.TenantId == tid).ToList();
            var lastUser = usersInTenants.Where(u => u.TenantId == tid).ToList();
            DateTime? lastLogin = lastUser.Count == 0
                ? null
                : lastUser.Max(u => u.LastLoginAt);

            result[tid] = new TenantMetrics
            {
                ActiveUserCount = uc,
                PendingInviteCount = pc,
                HasOrgAdminUser = hasOrgAdminByTenant.Contains(tid),
                OrgAdminInvites = invites,
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
            Slug = tenant.Slug,
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
        var inviteDto = BuildInviteStatus(m.OrgAdminInvites);

        return new PlatformOrganizationDetailDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            Slug = tenant.Slug,
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

    private PlatformOrganizationInviteStatusDto BuildInviteStatus(List<InviteToken> orgAdminInvites)
    {
        var accepted = orgAdminInvites.FirstOrDefault(i => i.AcceptedAt != null);
        if (accepted != null)
        {
            return new PlatformOrganizationInviteStatusDto
            {
                InviteId = accepted.Id,
                Status = "accepted",
                Email = accepted.Email,
                SentAt = accepted.CreatedAt,
                ExpiresAt = accepted.ExpiresAt,
                InviteLink = null,
                DeliveryStatus = accepted.DeliveryStatus,
                DeliveryMessage = accepted.DeliveryMessage,
                DeliveryRecordedAt = accepted.DeliveryRecordedAt
            };
        }

        var pending = orgAdminInvites
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
                InviteLink = BuildInviteLink(pending.Token),
                DeliveryStatus = pending.DeliveryStatus,
                DeliveryMessage = pending.DeliveryMessage,
                DeliveryRecordedAt = pending.DeliveryRecordedAt
            };
        }

        var expired = orgAdminInvites
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
                InviteLink = null,
                DeliveryStatus = expired.DeliveryStatus,
                DeliveryMessage = expired.DeliveryMessage,
                DeliveryRecordedAt = expired.DeliveryRecordedAt
            };
        }

        return new PlatformOrganizationInviteStatusDto
        {
            InviteId = null,
            Status = "none",
            Email = null,
            SentAt = null,
            ExpiresAt = null,
            InviteLink = null,
            DeliveryStatus = null,
            DeliveryMessage = null,
            DeliveryRecordedAt = null
        };
    }

    private static string ComputeOperationalStatus(Tenant tenant, TenantMetrics m)
    {
        if (tenant.IsArchived)
            return OrganizationOperationalStatus.Archived;
        if (!tenant.IsActive)
            return OrganizationOperationalStatus.Suspended;
        if (m.HasOrgAdminUser)
            return OrganizationOperationalStatus.Active;

        var hasPendingOrgAdminInvite = m.OrgAdminInvites.Any(i =>
            i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow);

        if (hasPendingOrgAdminInvite)
            return OrganizationOperationalStatus.Invited;

        if (m.OrgAdminInvites.Count == 0)
            return OrganizationOperationalStatus.Draft;

        // Has invites but all expired/failed — still in "invited" lifecycle stage
        return OrganizationOperationalStatus.Invited;
    }

}
