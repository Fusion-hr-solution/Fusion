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
    IConfiguration configuration,
    IInvitationLinkBuilder invitationLinkBuilder,
    IWorkforceInvitationEmailSender? invitationEmailSender = null) : IPlatformOrganizationService
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
                PlatformRole.HRAdmin,
                createdByUserId,
                request.FirstAdminFirstName,
                request.FirstAdminLastName);

            db.InviteTokens.Add(invite);
            await db.SaveChangesAsync(cancellationToken);

        var link = invitationLinkBuilder.BuildInviteLink(invite.Token);
            if (invitationEmailSender is not null)
            {
                var deliveryResult = await SendFirstAdminInviteEmailAsync(
                    invite,
                    tenant.Name,
                    link,
                    cancellationToken);
                invite.RecordDeliveryAttempt(deliveryResult.Status, deliveryResult.Message);
                await db.SaveChangesAsync(cancellationToken);
            }

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
            .Include(i => i.Tenant)
            .Where(i => i.TenantId == tenantId && i.Role == PlatformRole.HRAdmin && i.AcceptedAt == null && !i.IsRevoked)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (invite is null)
            return null;

        invite.ExtendExpiry();
        await db.SaveChangesAsync(cancellationToken);
        var link = invitationLinkBuilder.BuildInviteLink(invite.Token);

        if (invitationEmailSender is not null)
        {
            var deliveryResult = await SendFirstAdminInviteEmailAsync(
                invite,
                invite.Tenant?.Name ?? "Fusion",
                link,
                cancellationToken);
            invite.RecordDeliveryAttempt(deliveryResult.Status, deliveryResult.Message);
            await db.SaveChangesAsync(cancellationToken);
        }

        return new PlatformOrganizationInviteStatusDto
        {
            InviteId = invite.Id,
            Status = "pending",
            Email = invite.Email,
            SentAt = invite.CreatedAt,
            ExpiresAt = invite.ExpiresAt,
            InviteLink = link,
            DeliveryStatus = invite.DeliveryStatus,
            DeliveryMessage = invite.DeliveryMessage,
            DeliveryRecordedAt = invite.DeliveryRecordedAt
        };
    }

    public async Task<bool> RevokePendingFirstAdminInvitesAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var pending = await db.InviteTokens
            .IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId && i.Role == PlatformRole.HRAdmin && i.AcceptedAt == null && !i.IsRevoked)
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
        var primaryEmail = await GetPrimaryHrAdminEmailAsync(tenantId, cancellationToken);
        return MapDetail(tenant, metrics, primaryEmail);
    }


    private async Task<WorkforceInvitationEmailDeliveryResult> SendFirstAdminInviteEmailAsync(
        InviteToken invite,
        string tenantName,
        string inviteLink,
        CancellationToken cancellationToken)
    {
        return await invitationEmailSender!.SendInvitationAsync(
            new WorkforceInvitationEmailMessage(
                invite.Id,
                invite.Email,
                inviteLink,
                tenantName,
                invite.Role,
                invite.FirstName,
                invite.LastName),
            cancellationToken);
    }

    private async Task<string?> GetPrimaryHrAdminEmailAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var hrAdminRoleId = await db.Roles.AsNoTracking()
            .Where(r => r.Name == PlatformRole.HRAdmin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (hrAdminRoleId == Guid.Empty)
            return null;

        var userId = await (from u in db.Users.IgnoreQueryFilters().AsNoTracking()
                join ur in db.UserRoles.AsNoTracking() on u.Id equals ur.UserId
                where u.TenantId == tenantId && ur.RoleId == hrAdminRoleId
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

        var usersInTenants = await db.Users.IgnoreQueryFilters().AsNoTracking()
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

        var hrInvitesByTenant = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .Where(i => tenantIds.Contains(i.TenantId) && i.Role == PlatformRole.HRAdmin && !i.IsRevoked)
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
                InviteLink = null,
                DeliveryStatus = accepted.DeliveryStatus,
                DeliveryMessage = accepted.DeliveryMessage,
                DeliveryRecordedAt = accepted.DeliveryRecordedAt
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
                InviteLink = invitationLinkBuilder.BuildInviteLink(pending.Token),
                DeliveryStatus = pending.DeliveryStatus,
                DeliveryMessage = pending.DeliveryMessage,
                DeliveryRecordedAt = pending.DeliveryRecordedAt
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
