using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.PlatformOrganizations;

public class PlatformOrganizationsControllerIntegrationTests
{
    [Fact]
    public async Task PlatformAdminEndpoints_RequirePlatformAdminRole()
    {
        await using var factory = new IdentityApiFactory();
        var client = factory.CreateClient();

        var unauth = await client.GetAsync("/api/identity/platform-admin/organizations");
        Assert.Equal(HttpStatusCode.Unauthorized, unauth.StatusCode);

        // Create a non-platform user
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var tenant = Tenant.Create("Tenant X");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var email = "user@example.com";
        var password = "User@1234";

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            TenantId = tenant.Id,
            IsActive = true,
            FirstName = "Regular",
            LastName = "User",
        };

        var result = await userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded);
        await userManager.AddToRoleAsync(user, PlatformRole.Employee);

        var accessToken = await LoginAsync(factory, email, password);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var forbidden = await client.GetAsync("/api/identity/platform-admin/organizations");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task PlatformAdmin_FullLifecycle_CRUD_Resend_Revoke_Suspend_Reactivate_Archive()
    {
        await using var factory = new IdentityApiFactory();
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var adminTenant = Tenant.Create("Platform Admin Tenant");
        db.Tenants.Add(adminTenant);
        await db.SaveChangesAsync();

        var adminEmail = "admin.platform@example.com";
        var adminPassword = "Admin@1234";

        var adminUser = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            NormalizedEmail = adminEmail.ToUpperInvariant(),
            EmailConfirmed = true,
            TenantId = adminTenant.Id,
            IsActive = true,
            FirstName = "Platform",
            LastName = "Admin",
        };

        var created = await userManager.CreateAsync(adminUser, adminPassword);
        Assert.True(created.Succeeded);
        await userManager.AddToRoleAsync(adminUser, PlatformRole.PlatformAdmin);

        var accessToken = await LoginAsync(factory, adminEmail, adminPassword);

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);

        // Create organization + first admin invite
        var createReq = new
        {
            name = "Acme Integration Org",
            firstAdminEmail = "firstadmin@example.com",
            firstAdminFirstName = "First",
            firstAdminLastName = "Admin",
        };

        var createResp = await client.PostAsJsonAsync(
            "/api/identity/platform-admin/organizations",
            createReq);

        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        using var createJson = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync());
        var createData = createJson.RootElement.GetProperty("data");
        var organization = createData.GetProperty("organization");
        var tenantId = organization.GetProperty("id").GetGuid();
        var inviteLink = createData.GetProperty("inviteLink").GetString();
        Assert.False(string.IsNullOrWhiteSpace(inviteLink));

        // List should include the new org
        var listResp = await client.GetAsync(
            "/api/identity/platform-admin/organizations");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        using var listJson = JsonDocument.Parse(await listResp.Content.ReadAsStringAsync());
        var listData = listJson.RootElement.GetProperty("data");
        var listItems = listData.GetProperty("items").EnumerateArray();
        Assert.Contains(listItems, x => x.GetProperty("id").GetGuid() == tenantId);

        // Detail should show invited state
        var detailResp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}");
        Assert.Equal(HttpStatusCode.OK, detailResp.StatusCode);

        using var detailJson = JsonDocument.Parse(await detailResp.Content.ReadAsStringAsync());
        var detailData = detailJson.RootElement.GetProperty("data");
        Assert.Equal("invited", detailData.GetProperty("operationalStatus").GetString());

        var firstAdminInvite = detailData.GetProperty("firstAdminInvite");
        Assert.Equal("pending", firstAdminInvite.GetProperty("status").GetString());
        Assert.False(firstAdminInvite.GetProperty("inviteLink").GetString() is null);

        // Suspend / Reactivate / Archive
        var suspendResp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/suspend",
            content: null);
        Assert.Equal(HttpStatusCode.OK, suspendResp.StatusCode);

        var suspendJson = JsonDocument.Parse(await suspendResp.Content.ReadAsStringAsync());
        var suspendOk = suspendJson.RootElement.GetProperty("data").GetBoolean();
        Assert.True(suspendOk);

        var suspendedDetailResp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}");
        using var suspendedJson = JsonDocument.Parse(await suspendedDetailResp.Content.ReadAsStringAsync());
        var suspendedData = suspendedJson.RootElement.GetProperty("data");
        Assert.Equal("suspended", suspendedData.GetProperty("operationalStatus").GetString());

        var reactivateResp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/reactivate",
            content: null);
        Assert.Equal(HttpStatusCode.OK, reactivateResp.StatusCode);

        var reactivateDetailResp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}");
        using var reactivateJson = JsonDocument.Parse(await reactivateDetailResp.Content.ReadAsStringAsync());
        var reactivateData = reactivateJson.RootElement.GetProperty("data");
        Assert.Equal("invited", reactivateData.GetProperty("operationalStatus").GetString());

        var archiveResp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/archive",
            content: null);
        Assert.Equal(HttpStatusCode.OK, archiveResp.StatusCode);

        var archivedDetailResp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}");
        using var archivedJson = JsonDocument.Parse(await archivedDetailResp.Content.ReadAsStringAsync());
        var archivedData = archivedJson.RootElement.GetProperty("data");
        Assert.Equal("archived", archivedData.GetProperty("operationalStatus").GetString());

        // Resend invite
        var resendResp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/first-admin-invite/resend",
            content: null);
        Assert.Equal(HttpStatusCode.OK, resendResp.StatusCode);

        using var resendJson = JsonDocument.Parse(await resendResp.Content.ReadAsStringAsync());
        var resendData = resendJson.RootElement.GetProperty("data");
        Assert.Equal("pending", resendData.GetProperty("status").GetString());

        // Revoke invite -> detail should go back to draft when not accepted
        var revokeResp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/first-admin-invite/revoke",
            content: null);
        Assert.Equal(HttpStatusCode.OK, revokeResp.StatusCode);

        var revokedDetailResp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}");
        using var revokedJson = JsonDocument.Parse(await revokedDetailResp.Content.ReadAsStringAsync());
        var revokedData = revokedJson.RootElement.GetProperty("data");

        // Archived tenant stays archived in our current status model.
        Assert.Equal("archived", revokedData.GetProperty("operationalStatus").GetString());
        Assert.Equal("none", revokedData.GetProperty("firstAdminInvite").GetProperty("status").GetString());
    }

    [Fact]
    public async Task AcceptInvite_ForFreshOrganization_AssignsSeededAccessProfileAndMarksInviteUsed()
    {
        await using var factory = new IdentityApiFactory();
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var adminTenant = Tenant.Create("Invite Accept Admin Tenant");
        db.Tenants.Add(adminTenant);
        await db.SaveChangesAsync();

        var adminEmail = "invite.accept.admin@example.com";
        var adminPassword = "Admin@1234";

        var adminUser = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            NormalizedEmail = adminEmail.ToUpperInvariant(),
            EmailConfirmed = true,
            TenantId = adminTenant.Id,
            IsActive = true,
            FirstName = "Invite",
            LastName = "Admin",
        };

        var created = await userManager.CreateAsync(adminUser, adminPassword);
        Assert.True(created.Succeeded);
        await userManager.AddToRoleAsync(adminUser, PlatformRole.PlatformAdmin);

        var accessToken = await LoginAsync(factory, adminEmail, adminPassword);

        var platformClient = factory.CreateClient();
        platformClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);

        var createReq = new
        {
            name = "Fresh Invite Acceptance Org",
            firstAdminEmail = "fresh.accept@example.com",
            firstAdminFirstName = "Fresh",
            firstAdminLastName = "Admin",
        };

        var createResp = await platformClient.PostAsJsonAsync(
            "/api/identity/platform-admin/organizations",
            createReq);

        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        using var createJson = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync());
        var createData = createJson.RootElement.GetProperty("data");
        var tenantId = createData.GetProperty("organization").GetProperty("id").GetGuid();
        var inviteLink = createData.GetProperty("inviteLink").GetString();
        Assert.False(string.IsNullOrWhiteSpace(inviteLink));

        var token = Uri.UnescapeDataString(inviteLink!.Split("token=")[1]);

        var anonymousClient = factory.CreateClient();
        var acceptResp = await anonymousClient.PostAsJsonAsync(
            $"/api/identity/invites/{Uri.EscapeDataString(token)}/accept",
            new
            {
                password = "FreshAccept@123!",
                firstName = "Fresh",
                lastName = "Admin",
            });

        Assert.Equal(HttpStatusCode.Created, acceptResp.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();

        var acceptedInvite = await verifyDb.InviteTokens
            .IgnoreQueryFilters()
            .FirstAsync(invite => invite.Token == token);
        Assert.NotNull(acceptedInvite.AcceptedAt);
        Assert.NotNull(acceptedInvite.AcceptedByUserId);

        var invitedUser = await verifyDb.Users
            .IgnoreQueryFilters()
            .FirstAsync(user => user.Email == createReq.firstAdminEmail);

        var assignments = await verifyDb.UserAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.TenantId == tenantId && assignment.UserId == invitedUser.Id)
            .ToListAsync();

        Assert.NotEmpty(assignments);

        var assignedProfileNames = await verifyDb.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == tenantId && assignments.Select(assignment => assignment.AccessProfileId).Contains(profile.Id))
            .Select(profile => profile.Name)
            .ToListAsync();

        Assert.Contains("Org Admin", assignedProfileNames);
    }

    [Fact]
    public async Task PatchOrganization_UpdatesNameAndNotes()
    {
        await using var factory = new IdentityApiFactory();
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var adminTenant = Tenant.Create("Patch Admin Tenant");
        db.Tenants.Add(adminTenant);
        await db.SaveChangesAsync();

        var adminEmail = "patch.admin@example.com";
        var adminPassword = "Admin@1234";

        var adminUser = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            NormalizedEmail = adminEmail.ToUpperInvariant(),
            EmailConfirmed = true,
            TenantId = adminTenant.Id,
            IsActive = true,
            FirstName = "Patch",
            LastName = "Admin",
        };

        var created = await userManager.CreateAsync(adminUser, adminPassword);
        Assert.True(created.Succeeded);
        await userManager.AddToRoleAsync(adminUser, PlatformRole.PlatformAdmin);

        var accessToken = await LoginAsync(factory, adminEmail, adminPassword);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);

        // Create an organization
        var createReq = new
        {
            name = "Patch Target Org",
            firstAdminEmail = "patch.target@example.com",
            firstAdminFirstName = "Patch",
            firstAdminLastName = "Target",
        };

        var createResp = await client.PostAsJsonAsync(
            "/api/identity/platform-admin/organizations", createReq);
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        using var createJson = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync());
        var tenantId = createJson.RootElement
            .GetProperty("data").GetProperty("organization").GetProperty("id").GetGuid();

        // PATCH name + notes
        var patchReq = new { name = "Renamed Org", internalNotes = "Admin notes here" };
        var patchResp = await client.PatchAsJsonAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}", patchReq);
        Assert.Equal(HttpStatusCode.OK, patchResp.StatusCode);

        using var patchJson = JsonDocument.Parse(await patchResp.Content.ReadAsStringAsync());
        var patchData = patchJson.RootElement.GetProperty("data");
        Assert.Equal("Renamed Org", patchData.GetProperty("name").GetString());
        Assert.Equal("Admin notes here", patchData.GetProperty("internalNotes").GetString());

        // Verify via GET detail
        var detailResp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}");
        using var detailJson = JsonDocument.Parse(await detailResp.Content.ReadAsStringAsync());
        var detailData = detailJson.RootElement.GetProperty("data");
        Assert.Equal("Renamed Org", detailData.GetProperty("name").GetString());
        Assert.Equal("Admin notes here", detailData.GetProperty("internalNotes").GetString());

        // PATCH nonexistent -> 404
        var notFoundResp = await client.PatchAsJsonAsync(
            $"/api/identity/platform-admin/organizations/{Guid.NewGuid()}", patchReq);
        Assert.Equal(HttpStatusCode.NotFound, notFoundResp.StatusCode);
    }

    [Fact]
    public async Task GetOrganization_NotFound_Returns404()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var resp = await client.GetAsync(
            $"/api/identity/platform-admin/organizations/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task SuspendOrganization_NotFound_Returns404()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var resp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{Guid.NewGuid()}/suspend", null);
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task SuspendOrganization_AlreadySuspended_Returns409()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        // Create an org
        var tenantId = await CreateOrgViaApiAsync(client, "Suspend Conflict Org", "s-conf@test.com");

        // Suspend once (succeeds)
        var resp1 = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/suspend", null);
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);

        // Suspend again (conflict)
        var resp2 = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/suspend", null);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task ReactivateOrganization_AlreadyActive_Returns409()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var tenantId = await CreateOrgViaApiAsync(client, "Reactivate Conflict Org", "r-conf@test.com");

        // Org is active by default — reactivating should conflict
        var resp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/reactivate", null);
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    [Fact]
    public async Task ArchiveOrganization_AlreadyArchived_Returns409()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var tenantId = await CreateOrgViaApiAsync(client, "Archive Conflict Org", "a-conf@test.com");

        // Archive once
        var resp1 = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/archive", null);
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);

        // Archive again — conflict
        var resp2 = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/archive", null);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task CreateOrganization_DuplicateName_Returns400()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        await CreateOrgViaApiAsync(client, "Unique Name Org", "uniq1@test.com");

        // Try duplicate
        var dupResp = await client.PostAsJsonAsync(
            "/api/identity/platform-admin/organizations",
            new { name = "unique name org", firstAdminEmail = "uniq2@test.com" });
        Assert.Equal(HttpStatusCode.BadRequest, dupResp.StatusCode);
    }

    [Fact]
    public async Task ResendInvite_NotFound_WhenNoPending()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var tenantId = await CreateOrgViaApiAsync(client, "Resend Test Org", "resend@test.com");

        // Revoke the invite first
        await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/first-admin-invite/revoke", null);

        // Now try to resend — should 404
        var resp = await client.PostAsync(
            $"/api/identity/platform-admin/organizations/{tenantId}/first-admin-invite/resend", null);
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task ListOrganizations_WithSearchFilter_ReturnsFiltered()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        await CreateOrgViaApiAsync(client, "Searchable Alpha", "search-a@test.com");
        await CreateOrgViaApiAsync(client, "Searchable Beta", "search-b@test.com");
        await CreateOrgViaApiAsync(client, "Other Gamma", "other@test.com");

        var resp = await client.GetAsync(
            "/api/identity/platform-admin/organizations?search=searchable");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        using var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var items = json.RootElement.GetProperty("data").GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
    }

    [Fact]
    public async Task ListOrganizations_InvalidSkip_Returns400()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var resp = await client.GetAsync(
            "/api/identity/platform-admin/organizations?skip=-1");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task ListOrganizations_InvalidTake_Returns400()
    {
        await using var factory = new IdentityApiFactory();
        var client = await CreateAuthenticatedPlatformAdminClientAsync(factory);

        var resp = await client.GetAsync(
            "/api/identity/platform-admin/organizations?take=0");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
    private static async Task<string> LoginAsync(
        IdentityApiFactory factory,
        string email,
        string password)
    {
        var client = factory.CreateClient();
        var loginResp = await client.PostAsJsonAsync(
            "/api/identity/auth/login",
            new { email, password });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);

        using var json = JsonDocument.Parse(await loginResp.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        return data.GetProperty("accessToken").GetString()
               ?? throw new InvalidOperationException("accessToken missing");
    }

    /// <summary>
    /// Creates a PlatformAdmin user and returns an authenticated HttpClient.
    /// </summary>
    private static async Task<HttpClient> CreateAuthenticatedPlatformAdminClientAsync(
        IdentityApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var adminTenant = Tenant.Create($"Admin Tenant {Guid.NewGuid():N}");
        db.Tenants.Add(adminTenant);
        await db.SaveChangesAsync();

        var email = $"admin-{Guid.NewGuid():N}@test.com";
        var password = "Admin@1234";

        var adminUser = new ApplicationUser
        {
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            TenantId = adminTenant.Id,
            IsActive = true,
            FirstName = "Platform",
            LastName = "Admin",
        };

        var created = await userManager.CreateAsync(adminUser, password);
        Assert.True(created.Succeeded);
        await userManager.AddToRoleAsync(adminUser, PlatformRole.PlatformAdmin);

        var accessToken = await LoginAsync(factory, email, password);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);

        return client;
    }

    /// <summary>
    /// Creates an organization via the API and returns the tenant ID.
    /// </summary>
    private static async Task<Guid> CreateOrgViaApiAsync(
        HttpClient client,
        string name,
        string adminEmail)
    {
        var resp = await client.PostAsJsonAsync(
            "/api/identity/platform-admin/organizations",
            new { name, firstAdminEmail = adminEmail });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        using var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return json.RootElement
            .GetProperty("data")
            .GetProperty("organization")
            .GetProperty("id")
            .GetGuid();
    }
}

