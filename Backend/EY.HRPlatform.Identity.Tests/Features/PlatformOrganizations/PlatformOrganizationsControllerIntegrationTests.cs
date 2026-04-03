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
        var listItems = listJson.RootElement.GetProperty("data").EnumerateArray();
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
}

