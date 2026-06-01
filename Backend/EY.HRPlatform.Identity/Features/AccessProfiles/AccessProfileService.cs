using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.AccessProfiles;

public interface IAccessProfileService
{
    Task EnsureSeedDataAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CorePermissionCatalogItemDto>> GetPermissionCatalogAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccessProfileSummaryDto>> GetProfilesAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<AccessProfileSummaryDto?> GetProfileAsync(Guid tenantId, Guid profileId, CancellationToken cancellationToken = default);
    Task<AccessProfileSummaryDto> CreateProfileAsync(Guid tenantId, CreateAccessProfileRequest request, CancellationToken cancellationToken = default);
    Task<AccessProfileSummaryDto> UpdateProfileAsync(Guid tenantId, Guid profileId, uint expectedVersion, UpdateAccessProfileRequest request, CancellationToken cancellationToken = default);
    Task DeleteProfileAsync(Guid tenantId, Guid profileId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserAccessAssignmentDto>> GetUserAssignmentsAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<UserAccessAssignmentDto> SetUserAccessProfilesAsync(Guid tenantId, Guid userId, IReadOnlyCollection<Guid> accessProfileIds, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserAccessAssignmentDto>> SetUserAccessProfilesBulkAsync(Guid tenantId, IReadOnlyCollection<Guid> userIds, IReadOnlyCollection<Guid> accessProfileIds, CancellationToken cancellationToken = default);
    Task<CurrentUserAccessDto> GetCurrentUserAccessAsync(ApplicationUser user, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccessProfileAssignmentSummaryDto>> GetAssignedProfilesAsync(ApplicationUser user, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EffectivePermissionGrant>> GetEffectivePermissionsAsync(ApplicationUser user, CancellationToken cancellationToken = default);
    Task SetInviteAccessProfilesAsync(Guid tenantId, Guid inviteId, IReadOnlyCollection<Guid> accessProfileIds, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccessProfileAssignmentSummaryDto>> GetInviteAccessProfilesAsync(Guid inviteId, CancellationToken cancellationToken = default);
    Task ApplyInviteProfilesAsync(InviteToken invite, ApplicationUser user, CancellationToken cancellationToken = default);
    Task SyncCompatibilityRolesAsync(ApplicationUser user, CancellationToken cancellationToken = default);
    string ResolveCompatibilityRole(IReadOnlyCollection<EffectivePermissionGrant> grants);
}

public sealed class AccessProfileService(
    AppIdentityDbContext dbContext,
    UserManager<ApplicationUser> userManager) : IAccessProfileService
{
    private static readonly string[] TenantRoles = [
        PlatformRole.HRAdmin,
        PlatformRole.Manager,
        PlatformRole.Employee,
    ];

    private static readonly string[] AdminCapabilityPermissions = [
        CorePermissions.AccessProfilesManage,
        CorePermissions.SettingsManage,
        CorePermissions.EmployeeManage,
        CorePermissions.StructureManage,
        CorePermissions.SetupManage,
        CorePermissions.AccessManage,
    ];

    public async Task EnsureSeedDataAsync(CancellationToken cancellationToken = default)
    {
        var tenantIds = await dbContext.Tenants
            .IgnoreQueryFilters()
            .Select(tenant => tenant.Id)
            .ToListAsync(cancellationToken);

        foreach (var tenantId in tenantIds)
        {
            await EnsureTenantProfilesAsync(tenantId, cancellationToken);
            await BackfillTenantAssignmentsAsync(tenantId, cancellationToken);
        }
    }

    public Task<IReadOnlyList<CorePermissionCatalogItemDto>> GetPermissionCatalogAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<CorePermissionCatalogItemDto>>(
            CorePermissionCatalog.All
                .Select(definition => new CorePermissionCatalogItemDto
                {
                    PermissionKey = definition.Key,
                    Label = definition.Label,
                    Group = definition.Group,
                    HelperText = definition.HelperText,
                    AllowedScopes = definition.AllowedScopes.ToList(),
                })
                .ToList());

    public async Task<IReadOnlyList<AccessProfileSummaryDto>> GetProfilesAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var profiles = await LoadProfilesAsync(tenantId, cancellationToken);
        return profiles.Select(MapProfile).ToList();
    }

    public async Task<AccessProfileSummaryDto?> GetProfileAsync(Guid tenantId, Guid profileId, CancellationToken cancellationToken = default)
    {
        var profile = await dbContext.AccessProfiles
            .Include(item => item.Grants)
            .Include(item => item.UserAssignments)
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.Id == profileId, cancellationToken);

        return profile is null ? null : MapProfile(profile);
    }

    public async Task<AccessProfileSummaryDto> CreateProfileAsync(Guid tenantId, CreateAccessProfileRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedGrants = NormalizeGrantInputs(request.Grants);
        await EnsureProfileNameAvailableAsync(tenantId, request.Name, profileId: null, cancellationToken);

        var profile = AccessProfile.Create(
            tenantId,
            request.Name,
            request.Description,
            AccessProfileTypes.Custom,
            isSystemProtected: false);

        profile.ReplaceGrants(normalizedGrants
            .Select(grant => AccessProfileGrant.Create(tenantId, profile.Id, grant.PermissionKey, grant.Scope)));

        dbContext.AccessProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapProfile(profile);
    }

    public async Task<AccessProfileSummaryDto> UpdateProfileAsync(
        Guid tenantId,
        Guid profileId,
        uint expectedVersion,
        UpdateAccessProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var profile = await dbContext.AccessProfiles
            .Include(item => item.Grants)
            .Include(item => item.UserAssignments)
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.Id == profileId, cancellationToken)
            ?? throw new InvalidOperationException("Access profile not found.");

        if (profile.Version != expectedVersion)
            throw new DbUpdateConcurrencyException("Access profile version mismatch.");

        if (profile.IsSystemProtected)
        {
            if (!string.Equals(profile.Name, request.Name?.Trim(), StringComparison.Ordinal))
                throw new InvalidOperationException("System access profile names cannot be renamed.");

            if (!string.Equals(profile.Description ?? string.Empty, request.Description ?? string.Empty, StringComparison.Ordinal))
                throw new InvalidOperationException("System access profile descriptions cannot be changed.");

            var currentGrantKeys = profile.Grants
                .Select(grant => $"{grant.PermissionKey}:{grant.Scope}")
                .OrderBy(key => key)
                .ToArray();
            var incomingGrantKeys = NormalizeGrantInputs(request.Grants)
                .Select(grant => $"{grant.PermissionKey}:{grant.Scope}")
                .OrderBy(key => key)
                .ToArray();

            if (!currentGrantKeys.SequenceEqual(incomingGrantKeys, StringComparer.Ordinal))
                throw new InvalidOperationException("System access profile permissions cannot be modified.");
        }

        await EnsureProfileNameAvailableAsync(tenantId, request.Name ?? string.Empty, profile.Id, cancellationToken);
        var normalizedGrants = NormalizeGrantInputs(request.Grants);

        var projectedPermissions = await BuildProjectedEffectivePermissionsAsync(
            tenantId,
            userProfileOverrides: null,
            profileGrantOverrides: new Dictionary<Guid, IReadOnlyList<EffectivePermissionGrant>>
            {
                [profile.Id] = normalizedGrants,
            },
            cancellationToken: cancellationToken);

        EnsureTenantSafety(projectedPermissions);

        profile.UpdateDetails(request.Name ?? string.Empty, request.Description);
        profile.ReplaceGrants(normalizedGrants
            .Select(grant => AccessProfileGrant.Create(tenantId, profile.Id, grant.PermissionKey, grant.Scope)));

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var assignment in profile.UserAssignments)
        {
            var user = await dbContext.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(item => item.Id == assignment.UserId, cancellationToken);
            if (user is not null)
            {
                await SyncCompatibilityRolesAsync(user, cancellationToken);
            }
        }

        return MapProfile(profile);
    }

    public async Task DeleteProfileAsync(Guid tenantId, Guid profileId, CancellationToken cancellationToken = default)
    {
        var profile = await dbContext.AccessProfiles
            .Include(item => item.UserAssignments)
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.Id == profileId, cancellationToken)
            ?? throw new InvalidOperationException("Access profile not found.");

        if (profile.IsSystemProtected)
            throw new InvalidOperationException("System access profiles cannot be deleted.");

        if (profile.UserAssignments.Count > 0)
            throw new InvalidOperationException("Assigned users must be reassigned before deleting this access profile.");

        dbContext.AccessProfiles.Remove(profile);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserAccessAssignmentDto>> GetUserAssignmentsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var users = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId)
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .ToListAsync(cancellationToken);

        var summariesByUserId = await LoadAssignedProfileSummariesByUserIdAsync(tenantId, users.Select(user => user.Id).ToList(), cancellationToken);

        return users.Select(user => MapUserAssignment(
            user,
            summariesByUserId.GetValueOrDefault(user.Id, []))).ToList();
    }

    public async Task<UserAccessAssignmentDto> SetUserAccessProfilesAsync(
        Guid tenantId,
        Guid userId,
        IReadOnlyCollection<Guid> accessProfileIds,
        CancellationToken cancellationToken = default)
    {
        var assignments = await SetUserAccessProfilesBulkAsync(
            tenantId,
            [userId],
            accessProfileIds,
            cancellationToken);

        return assignments.Single();
    }

    public async Task<IReadOnlyList<UserAccessAssignmentDto>> SetUserAccessProfilesBulkAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> userIds,
        IReadOnlyCollection<Guid> accessProfileIds,
        CancellationToken cancellationToken = default)
    {
        var normalizedUserIds = userIds
            .Where(userId => userId != Guid.Empty)
            .Distinct()
            .ToArray();

        if (normalizedUserIds.Length == 0)
        {
            return [];
        }

        var users = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(item => item.TenantId == tenantId && normalizedUserIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        if (users.Count != normalizedUserIds.Length)
        {
            throw new InvalidOperationException(
                normalizedUserIds.Length == 1
                    ? "User not found."
                    : "One or more users were not found.");
        }

        var normalizedIds = accessProfileIds
            .Where(profileId => profileId != Guid.Empty)
            .Distinct()
            .ToArray();

        var validProfileIds = await dbContext.AccessProfiles
            .Where(profile => profile.TenantId == tenantId && normalizedIds.Contains(profile.Id))
            .Select(profile => profile.Id)
            .ToListAsync(cancellationToken);

        if (validProfileIds.Count != normalizedIds.Length)
            throw new InvalidOperationException("One or more access profiles do not belong to this tenant.");

        var projectedPermissions = await BuildProjectedEffectivePermissionsAsync(
            tenantId,
            userProfileOverrides: normalizedUserIds.ToDictionary(
                currentUserId => currentUserId,
                _ => (IReadOnlyCollection<Guid>)normalizedIds),
            profileGrantOverrides: null,
            cancellationToken: cancellationToken);

        EnsureTenantSafety(projectedPermissions);

        var existingAssignments = await dbContext.UserAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.TenantId == tenantId && normalizedUserIds.Contains(assignment.UserId))
            .ToListAsync(cancellationToken);

        dbContext.UserAccessProfiles.RemoveRange(existingAssignments);
        dbContext.UserAccessProfiles.AddRange(
            normalizedUserIds.SelectMany(currentUserId => normalizedIds.Select(profileId =>
                UserAccessProfile.Create(tenantId, currentUserId, profileId))));

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var user in users)
        {
            await SyncCompatibilityRolesAsync(user, cancellationToken);
        }

        var profilesByUserId = await LoadAssignedProfileSummariesByUserIdAsync(
            tenantId,
            normalizedUserIds,
            cancellationToken);
        var usersById = users.ToDictionary(user => user.Id);

        return normalizedUserIds
            .Select(currentUserId => MapUserAssignment(
                usersById[currentUserId],
                profilesByUserId.GetValueOrDefault(currentUserId, [])))
            .ToList();
    }

    public async Task<CurrentUserAccessDto> GetCurrentUserAccessAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        return new CurrentUserAccessDto
        {
            TenantId = user.TenantId,
            AccessProfiles = (await GetAssignedProfilesAsync(user, cancellationToken)).ToList(),
            EffectivePermissions = (await GetEffectivePermissionsAsync(user, cancellationToken))
                .Select(MapGrant)
                .ToList(),
        };
    }

    public async Task<IReadOnlyList<AccessProfileAssignmentSummaryDto>> GetAssignedProfilesAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var assignments = await dbContext.UserAccessProfiles
            .Where(assignment => assignment.TenantId == user.TenantId && assignment.UserId == user.Id)
            .Join(
                dbContext.AccessProfiles,
                assignment => assignment.AccessProfileId,
                profile => profile.Id,
                (_, profile) => new AccessProfileAssignmentSummaryDto
                {
                    Id = profile.Id,
                    Name = profile.Name,
                    Type = profile.Type,
                    IsSystemProtected = profile.IsSystemProtected,
                })
            .OrderBy(profile => profile.Name)
            .ToListAsync(cancellationToken);

        return assignments;
    }

    public async Task<IReadOnlyList<EffectivePermissionGrant>> GetEffectivePermissionsAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var assignments = await EnsureAssignedProfileIdsAsync(user, cancellationToken);

        if (assignments.Count == 0)
        {
            return await BuildCompatibilityFallbackGrantsAsync(user, cancellationToken);
        }

        var grants = await dbContext.AccessProfileGrants
            .Where(grant => grant.TenantId == user.TenantId && assignments.Contains(grant.AccessProfileId))
            .ToListAsync(cancellationToken);

        return AggregateEffectivePermissions(grants.Select(grant =>
            new EffectivePermissionGrant(grant.PermissionKey, grant.Scope)));
    }

    public async Task SetInviteAccessProfilesAsync(
        Guid tenantId,
        Guid inviteId,
        IReadOnlyCollection<Guid> accessProfileIds,
        CancellationToken cancellationToken = default)
    {
        var normalizedIds = accessProfileIds
            .Where(profileId => profileId != Guid.Empty)
            .Distinct()
            .ToArray();

        var validProfileIds = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == tenantId && normalizedIds.Contains(profile.Id))
            .Select(profile => profile.Id)
            .ToListAsync(cancellationToken);

        if (validProfileIds.Count != normalizedIds.Length)
            throw new InvalidOperationException("One or more access profiles do not belong to this tenant.");

        var existing = await dbContext.InviteAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.TenantId == tenantId && assignment.InviteTokenId == inviteId)
            .ToListAsync(cancellationToken);

        dbContext.InviteAccessProfiles.RemoveRange(existing);
        dbContext.InviteAccessProfiles.AddRange(normalizedIds.Select(profileId =>
            InviteAccessProfile.Create(tenantId, inviteId, profileId)));

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AccessProfileAssignmentSummaryDto>> GetInviteAccessProfilesAsync(Guid inviteId, CancellationToken cancellationToken = default)
    {
        return await dbContext.InviteAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.InviteTokenId == inviteId)
            .Join(
                dbContext.AccessProfiles.IgnoreQueryFilters(),
                assignment => assignment.AccessProfileId,
                profile => profile.Id,
                (_, profile) => new AccessProfileAssignmentSummaryDto
                {
                    Id = profile.Id,
                    Name = profile.Name,
                    Type = profile.Type,
                    IsSystemProtected = profile.IsSystemProtected,
                })
            .OrderBy(profile => profile.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task ApplyInviteProfilesAsync(InviteToken invite, ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var inviteProfiles = await dbContext.InviteAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.InviteTokenId == invite.Id)
            .Select(assignment => assignment.AccessProfileId)
            .ToListAsync(cancellationToken);

        if (inviteProfiles.Count == 0)
        {
            await EnsureTenantProfilesAsync(invite.TenantId, cancellationToken);

            var seededProfile = await ResolveSeededProfileIdAsync(invite.TenantId, invite.Role, cancellationToken);
            if (seededProfile.HasValue)
            {
                inviteProfiles.Add(seededProfile.Value);
            }
        }

        if (inviteProfiles.Count == 0)
            throw new InvalidOperationException("Invitation does not have an access profile assignment.");

        var existingAssignments = await dbContext.UserAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.TenantId == invite.TenantId && assignment.UserId == user.Id)
            .ToListAsync(cancellationToken);

        var assignedIds = existingAssignments.Select(assignment => assignment.AccessProfileId).ToHashSet();
        foreach (var profileId in inviteProfiles)
        {
            if (assignedIds.Add(profileId))
            {
                dbContext.UserAccessProfiles.Add(UserAccessProfile.Create(invite.TenantId, user.Id, profileId));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await SyncCompatibilityRolesAsync(user, cancellationToken);
    }

    public async Task SyncCompatibilityRolesAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Contains(PlatformRole.PlatformAdmin, StringComparer.Ordinal))
        {
            var removable = currentRoles.Where(role => TenantRoles.Contains(role, StringComparer.Ordinal)).ToArray();
            if (removable.Length > 0)
            {
                await userManager.RemoveFromRolesAsync(user, removable);
            }
            return;
        }

        var effectivePermissions = await GetEffectivePermissionsAsync(user, cancellationToken);
        var desiredRoles = DetermineCompatibilityRoles(effectivePermissions);
        var currentTenantRoles = currentRoles.Where(role => TenantRoles.Contains(role, StringComparer.Ordinal)).ToArray();
        var rolesToAdd = desiredRoles.Except(currentTenantRoles, StringComparer.Ordinal).ToArray();
        var rolesToRemove = currentTenantRoles.Except(desiredRoles, StringComparer.Ordinal).ToArray();

        if (rolesToRemove.Length > 0)
        {
            var removeResult = await userManager.RemoveFromRolesAsync(user, rolesToRemove);
            if (!removeResult.Succeeded)
                throw new InvalidOperationException(string.Join(", ", removeResult.Errors.Select(error => error.Description)));
        }

        if (rolesToAdd.Length > 0)
        {
            var addResult = await userManager.AddToRolesAsync(user, rolesToAdd);
            if (!addResult.Succeeded)
                throw new InvalidOperationException(string.Join(", ", addResult.Errors.Select(error => error.Description)));
        }
    }

    public string ResolveCompatibilityRole(IReadOnlyCollection<EffectivePermissionGrant> grants)
        => DetermineCompatibilityRoles(grants).FirstOrDefault() ?? PlatformRole.Employee;

    private static string[] DetermineCompatibilityRoles(IReadOnlyCollection<EffectivePermissionGrant> effectivePermissions)
    {
        var roles = new List<string>();

        if (HasHrAdminCompatibilityCoverage(effectivePermissions))
        {
            roles.Add(PlatformRole.HRAdmin);
        }

        if (effectivePermissions.Any(grant =>
                (grant.PermissionKey == CorePermissions.TeamView && grant.Scope == PermissionScopes.DirectReports)
                || (grant.PermissionKey == CorePermissions.EmployeeView && PermissionScopes.GetRank(grant.Scope) >= PermissionScopes.GetRank(PermissionScopes.DirectReports))))
        {
            roles.Add(PlatformRole.Manager);
        }

        if (effectivePermissions.Any(grant =>
                grant.PermissionKey is CorePermissions.ProfileSelfView or CorePermissions.ProfileSelfUpdate or CorePermissions.EmployeeView
                && PermissionScopes.GetRank(grant.Scope) >= PermissionScopes.GetRank(PermissionScopes.Self)))
        {
            roles.Add(PlatformRole.Employee);
        }

        return roles.Distinct(StringComparer.Ordinal).ToArray();
    }

    private static bool HasHrAdminCompatibilityCoverage(IReadOnlyCollection<EffectivePermissionGrant> effectivePermissions)
        => AccessProfileTemplates.HrAdmin.Grants.All(required =>
            effectivePermissions.Any(grant =>
                string.Equals(grant.PermissionKey, required.PermissionKey, StringComparison.Ordinal)
                && PermissionScopes.GetRank(grant.Scope) >= PermissionScopes.GetRank(required.Scope)));

    private async Task EnsureTenantProfilesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var existingProfiles = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Include(profile => profile.Grants)
            .Where(profile => profile.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var existingByName = existingProfiles.ToDictionary(profile => profile.NormalizedName, StringComparer.Ordinal);
        var created = false;

        foreach (var template in AccessProfileTemplates.All)
        {
            var normalizedName = template.Name.ToUpperInvariant();
            if (existingByName.ContainsKey(normalizedName))
            {
                continue;
            }

            var profile = AccessProfile.Create(
                tenantId,
                template.Name,
                template.Description,
                AccessProfileTypes.SystemSeeded,
                template.IsSystemProtected);
            profile.ReplaceGrants(template.Grants.Select(grant =>
                AccessProfileGrant.Create(tenantId, profile.Id, grant.PermissionKey, grant.Scope)));
            dbContext.AccessProfiles.Add(profile);
            created = true;
        }

        if (created)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task BackfillTenantAssignmentsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var seededProfiles = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == tenantId && profile.Type == AccessProfileTypes.SystemSeeded)
            .ToListAsync(cancellationToken);

        var seededByName = seededProfiles.ToDictionary(profile => profile.Name, StringComparer.Ordinal);

        var users = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        foreach (var user in users)
        {
            var hasAssignments = await dbContext.UserAccessProfiles
                .IgnoreQueryFilters()
                .AnyAsync(assignment => assignment.TenantId == tenantId && assignment.UserId == user.Id, cancellationToken);
            if (hasAssignments)
            {
                continue;
            }

            var desiredProfiles = await ResolveRoleMappedSeededProfileIdsAsync(user, seededByName);

            if (desiredProfiles.Count == 0)
            {
                continue;
            }

            dbContext.UserAccessProfiles.AddRange(desiredProfiles.Select(profileId =>
                UserAccessProfile.Create(tenantId, user.Id, profileId)));
            await dbContext.SaveChangesAsync(cancellationToken);
            await SyncCompatibilityRolesAsync(user, cancellationToken);
        }
    }

    private async Task<List<AccessProfile>> LoadProfilesAsync(Guid tenantId, CancellationToken cancellationToken)
        => await dbContext.AccessProfiles
            .Include(profile => profile.Grants)
            .Include(profile => profile.UserAssignments)
            .Where(profile => profile.TenantId == tenantId)
            .OrderBy(profile => profile.Type)
            .ThenBy(profile => profile.Name)
            .ToListAsync(cancellationToken);

    private static IReadOnlyList<EffectivePermissionGrant> NormalizeGrantInputs(IEnumerable<AccessProfileGrantInputDto> grants)
    {
        var normalized = new Dictionary<string, EffectivePermissionGrant>(StringComparer.Ordinal);

        foreach (var input in grants)
        {
            var grant = CorePermissionCatalog.NormalizeGrant(input.PermissionKey, input.Scope)
                ?? throw new InvalidOperationException($"Invalid permission or scope: {input.PermissionKey} / {input.Scope}.");

            if (!normalized.TryGetValue(grant.PermissionKey, out var current))
            {
                normalized[grant.PermissionKey] = grant;
                continue;
            }

            normalized[grant.PermissionKey] =
                PermissionScopes.GetRank(grant.Scope) > PermissionScopes.GetRank(current.Scope)
                    ? grant
                    : current;
        }

        return normalized.Values.ToList();
    }

    private async Task EnsureProfileNameAvailableAsync(Guid tenantId, string name, Guid? profileId, CancellationToken cancellationToken)
    {
        var normalizedName = name.Trim().ToUpperInvariant();
        var exists = await dbContext.AccessProfiles
            .AnyAsync(profile =>
                profile.TenantId == tenantId
                && profile.NormalizedName == normalizedName
                && (!profileId.HasValue || profile.Id != profileId.Value), cancellationToken);

        if (exists)
            throw new InvalidOperationException("An access profile with this name already exists.");
    }

    private async Task<Dictionary<Guid, List<AccessProfileAssignmentSummaryDto>>> LoadAssignedProfileSummariesByUserIdAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.UserAccessProfiles
            .Where(assignment => assignment.TenantId == tenantId && userIds.Contains(assignment.UserId))
            .Join(
                dbContext.AccessProfiles,
                assignment => assignment.AccessProfileId,
                profile => profile.Id,
                (assignment, profile) => new
                {
                    assignment.UserId,
                    Summary = new AccessProfileAssignmentSummaryDto
                    {
                        Id = profile.Id,
                        Name = profile.Name,
                        Type = profile.Type,
                        IsSystemProtected = profile.IsSystemProtected,
                    },
                })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(row => row.Summary).OrderBy(summary => summary.Name).ToList());
    }

    private static UserAccessAssignmentDto MapUserAssignment(
        ApplicationUser user,
        IReadOnlyCollection<AccessProfileAssignmentSummaryDto> accessProfiles)
        => new()
        {
            UserId = user.Id,
            EmployeeId = user.EmployeeId,
            Email = user.Email ?? string.Empty,
            FullName = user.FullName,
            Department = user.Department,
            JobTitle = user.JobTitle,
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt,
            AccessProfiles = accessProfiles.ToList(),
        };

    private AccessProfileSummaryDto MapProfile(AccessProfile profile)
        => new()
        {
            Id = profile.Id,
            Name = profile.Name,
            Description = profile.Description,
            Type = profile.Type,
            IsSystemProtected = profile.IsSystemProtected,
            AssignedUserCount = profile.UserAssignments.Count,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt,
            Version = profile.Version,
            Grants = profile.Grants
                .OrderBy(grant => CorePermissionCatalog.Get(grant.PermissionKey).Group)
                .ThenBy(grant => CorePermissionCatalog.Get(grant.PermissionKey).Label)
                .Select(grant => MapGrant(new EffectivePermissionGrant(grant.PermissionKey, grant.Scope)))
                .ToList(),
        };

    private static EffectivePermissionGrantDto MapGrant(EffectivePermissionGrant grant)
    {
        var definition = CorePermissionCatalog.Get(grant.PermissionKey);
        return new EffectivePermissionGrantDto
        {
            PermissionKey = grant.PermissionKey,
            Scope = grant.Scope,
            Label = definition.Label,
            Group = definition.Group,
            HelperText = definition.HelperText,
            AllowedScopes = definition.AllowedScopes.ToList(),
        };
    }

    private static IReadOnlyList<EffectivePermissionGrant> AggregateEffectivePermissions(IEnumerable<EffectivePermissionGrant> grants)
        => grants
            .GroupBy(grant => grant.PermissionKey, StringComparer.Ordinal)
            .Select(group => group.Aggregate((current, next) =>
                PermissionScopes.GetRank(next.Scope) > PermissionScopes.GetRank(current.Scope)
                    ? next
                    : current))
            .ToList();

    private async Task<Guid?> ResolveSeededProfileIdAsync(Guid tenantId, string role, CancellationToken cancellationToken)
        => await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == tenantId && profile.Name == role)
            .Select(profile => (Guid?)profile.Id)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<Dictionary<Guid, IReadOnlyList<EffectivePermissionGrant>>> BuildProjectedEffectivePermissionsAsync(
        Guid tenantId,
        Dictionary<Guid, IReadOnlyCollection<Guid>>? userProfileOverrides,
        Dictionary<Guid, IReadOnlyList<EffectivePermissionGrant>>? profileGrantOverrides,
        CancellationToken cancellationToken)
    {
        var activeUsers = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId && user.IsActive)
            .ToListAsync(cancellationToken);

        var assignments = await dbContext.UserAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var grants = await dbContext.AccessProfileGrants
            .IgnoreQueryFilters()
            .Where(grant => grant.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var profileGrants = grants
            .GroupBy(grant => grant.AccessProfileId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EffectivePermissionGrant>)AggregateEffectivePermissions(group.Select(item =>
                    new EffectivePermissionGrant(item.PermissionKey, item.Scope))));

        if (profileGrantOverrides is not null)
        {
            foreach (var (profileId, overrideGrants) in profileGrantOverrides)
            {
                profileGrants[profileId] = overrideGrants;
            }
        }

        var profileIdBySeededName = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == tenantId && profile.Type == AccessProfileTypes.SystemSeeded)
            .ToDictionaryAsync(
                profile => profile.Name,
                profile => profile.Id,
                StringComparer.Ordinal,
                cancellationToken);

        var userProfiles = assignments
            .GroupBy(assignment => assignment.UserId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<Guid>)group.Select(item => item.AccessProfileId).Distinct().ToArray());

        if (userProfileOverrides is not null)
        {
            foreach (var (userId, profileIds) in userProfileOverrides)
            {
                userProfiles[userId] = profileIds;
            }
        }

        var rolesByUserId = await dbContext.UserRoles
            .IgnoreQueryFilters()
            .Join(
                dbContext.Roles.IgnoreQueryFilters(),
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, role) => new { userRole.UserId, RoleName = role.Name! })
            .Where(item => activeUsers.Select(user => user.Id).Contains(item.UserId))
            .ToListAsync(cancellationToken);

        var roleLookup = rolesByUserId
            .GroupBy(item => item.UserId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.RoleName).ToArray());

        var result = new Dictionary<Guid, IReadOnlyList<EffectivePermissionGrant>>();

        foreach (var user in activeUsers)
        {
            if (userProfiles.TryGetValue(user.Id, out var profileIds) && profileIds.Count > 0)
            {
                var effective = AggregateEffectivePermissions(profileIds
                    .SelectMany(profileId => profileGrants.GetValueOrDefault(profileId, [])));
                result[user.Id] = effective;
                continue;
            }

            var seededFallbackProfileIds = roleLookup
                .GetValueOrDefault(user.Id, [])
                .Where(role => profileIdBySeededName.ContainsKey(role) && role != PlatformRole.PlatformAdmin)
                .Select(role => profileIdBySeededName[role])
                .Distinct()
                .ToArray();

            if (seededFallbackProfileIds.Length > 0)
            {
                result[user.Id] = AggregateEffectivePermissions(seededFallbackProfileIds
                    .SelectMany(profileId => profileGrants.GetValueOrDefault(profileId, [])));
                continue;
            }

            result[user.Id] = AccessProfileTemplates.BuildLegacyFallbackGrants(roleLookup.GetValueOrDefault(user.Id, []));
        }

        return result;
    }

    private async Task<List<Guid>> EnsureAssignedProfileIdsAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var assignments = await dbContext.UserAccessProfiles
            .Where(assignment => assignment.TenantId == user.TenantId && assignment.UserId == user.Id)
            .Select(assignment => assignment.AccessProfileId)
            .ToListAsync(cancellationToken);

        if (assignments.Count > 0)
        {
            return assignments;
        }

        await EnsureTenantProfilesAsync(user.TenantId, cancellationToken);

        if (await TryBackfillUserAssignmentsFromRolesAsync(user, cancellationToken))
        {
            return await dbContext.UserAccessProfiles
                .Where(assignment => assignment.TenantId == user.TenantId && assignment.UserId == user.Id)
                .Select(assignment => assignment.AccessProfileId)
                .ToListAsync(cancellationToken);
        }

        return assignments;
    }

    private async Task<bool> TryBackfillUserAssignmentsFromRolesAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var seededProfiles = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == user.TenantId && profile.Type == AccessProfileTypes.SystemSeeded)
            .ToListAsync(cancellationToken);

        var seededByName = seededProfiles.ToDictionary(profile => profile.Name, StringComparer.Ordinal);
        var desiredProfiles = await ResolveRoleMappedSeededProfileIdsAsync(user, seededByName);
        if (desiredProfiles.Count == 0)
        {
            return false;
        }

        dbContext.UserAccessProfiles.AddRange(desiredProfiles.Select(profileId =>
            UserAccessProfile.Create(user.TenantId, user.Id, profileId)));
        await dbContext.SaveChangesAsync(cancellationToken);
        await SyncCompatibilityRolesAsync(user, cancellationToken);
        return true;
    }

    private async Task<List<Guid>> ResolveRoleMappedSeededProfileIdsAsync(
        ApplicationUser user,
        IReadOnlyDictionary<string, AccessProfile> seededByName)
    {
        var roles = await userManager.GetRolesAsync(user);
        return roles
            .Where(role => seededByName.ContainsKey(role) && role != PlatformRole.PlatformAdmin)
            .Select(role => seededByName[role].Id)
            .Distinct()
            .ToList();
    }

    private async Task<IReadOnlyList<EffectivePermissionGrant>> BuildCompatibilityFallbackGrantsAsync(
        ApplicationUser user,
        CancellationToken cancellationToken)
    {
        // Compatibility bridge only: prefer persisted access-profile assignments whenever possible.
        var roles = await userManager.GetRolesAsync(user);
        return AccessProfileTemplates.BuildLegacyFallbackGrants(roles);
    }

    private static void EnsureTenantSafety(IReadOnlyDictionary<Guid, IReadOnlyList<EffectivePermissionGrant>> permissionsByUserId)
    {
        var hasAccessProfileManager = permissionsByUserId.Values.Any(grants =>
            grants.Any(grant => grant.PermissionKey == CorePermissions.AccessProfilesManage && grant.Scope == PermissionScopes.Tenant));

        if (!hasAccessProfileManager)
        {
            throw new InvalidOperationException(
                "A tenant must always have at least one active account that can manage access profiles.");
        }

        var hasAdminCapableUser = permissionsByUserId.Values.Any(grants =>
            grants.Any(grant => AdminCapabilityPermissions.Contains(grant.PermissionKey, StringComparer.Ordinal)
                && grant.Scope == PermissionScopes.Tenant));

        if (!hasAdminCapableUser)
        {
            throw new InvalidOperationException(
                "A tenant must always keep at least one active account with Core administrative access.");
        }
    }
}
