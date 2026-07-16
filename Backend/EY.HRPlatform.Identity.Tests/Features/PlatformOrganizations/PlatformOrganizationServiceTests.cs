using System.Reflection;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Tests.Features.PlatformOrganizations;

public class PlatformOrganizationServiceTests
{
    [Fact]
    public async Task ListAsync_ReturnsDraft_WhenNoHrAdminUserOrPendingInvite()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Draft Tenant");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("draft", summary.OperationalStatus);
        Assert.Equal(0, summary.PendingInviteCount);
        Assert.Equal(0, summary.ActiveUserCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsInvited_WhenPendingHrAdminInviteExists()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Invited Tenant");
        var createdBy = Guid.NewGuid();
        var invite = InviteToken.Create(
            "admin@example.com",
            tenant.Id,
            PlatformRole.OrgAdmin,
            createdBy,
            expiryDays: 7);

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("invited", summary.OperationalStatus);
        Assert.Equal(1, summary.PendingInviteCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsActive_WhenHrAdminUserRoleExists()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Active Tenant");

        var hrRole = new IdentityRole<Guid>
        {
            Id = Guid.NewGuid(),
            Name = PlatformRole.OrgAdmin,
            NormalizedName = PlatformRole.OrgAdmin.ToUpperInvariant(),
        };

        var hrAdminUser = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "hradmin@example.com",
            Email = "hradmin@example.com",
            NormalizedEmail = "HRADMIN@EXAMPLE.COM",
            EmailConfirmed = true,
            TenantId = tenant.Id,
            IsActive = true,
            FirstName = "Hr",
            LastName = "Admin",
            LastLoginAt = DateTime.UtcNow.AddMinutes(-10),
        };

        db.Tenants.Add(tenant);
        db.Roles.Add(hrRole);
        db.Users.Add(hrAdminUser);
        db.UserRoles.Add(new IdentityUserRole<Guid>
        {
            UserId = hrAdminUser.Id,
            RoleId = hrRole.Id
        });

        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("active", summary.OperationalStatus);
        Assert.Equal(1, summary.ActiveUserCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsInvited_WhenHrAdminInviteExpiredAndNoHrAdminUser()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Attention Tenant");
        var createdBy = Guid.NewGuid();

        var invite = InviteToken.Create(
            "admin@example.com",
            tenant.Id,
            PlatformRole.OrgAdmin,
            createdBy,
            expiryDays: 1);

        SetPrivateProperty(invite, "ExpiresAt", DateTime.UtcNow.AddMinutes(-1));

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("invited", summary.OperationalStatus);
        Assert.Equal(0, summary.PendingInviteCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsSuspended_WhenTenantIsInactive()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Suspended Tenant");
        tenant.Deactivate();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("suspended", summary.OperationalStatus);
    }

    [Fact]
    public async Task ListAsync_ReturnsArchived_WhenTenantIsArchived()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Archived Tenant");
        tenant.Archive();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("archived", summary.OperationalStatus);
    }

    [Fact]
    public async Task CreateAsync_CreatesTenantAndFirstInvite()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var createdBy = Guid.NewGuid();
        var request = new CreatePlatformOrganizationRequest
        {
            Name = "Test Org",
            FirstAdminEmail = "first.admin@example.com",
            FirstAdminFirstName = "First",
            FirstAdminLastName = "Admin",
        };

        // Act
        var created = await service.CreateAsync(request, createdBy);

        // Assert
        Assert.Equal("Test Org", created.Organization.Name);
        Assert.Equal("invited", created.Organization.OperationalStatus);
        Assert.NotNull(created.InviteLink);
        Assert.Contains("/invite/accept", created.InviteLink);
    }

    [Fact]
    public async Task CreateAsync_ProvisionsPerformanceForCreatedTenant()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var provisioning = new RecordingPerformanceProvisioningClient();
        var service = new PlatformOrganizationService(db, configuration, provisioning);

        var request = new CreatePlatformOrganizationRequest
        {
            Name = "Performance Provisioned Org",
            FirstAdminEmail = "first.admin@provisioned.com",
            FirstAdminFirstName = "First",
            FirstAdminLastName = "Admin",
        };

        // Act
        var created = await service.CreateAsync(request, Guid.NewGuid());

        // Assert
        Assert.Equal(created.Organization.Id, provisioning.ProvisionedTenantId);
        Assert.Equal(1, provisioning.CallCount);
    }

    [Fact]
    public async Task CreateAsync_Throws_WhenEmailAlreadyRegistered()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var createdBy = Guid.NewGuid();

        db.Users.Add(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "dup@example.com",
            Email = "dup@example.com",
            NormalizedEmail = "DUP@EXAMPLE.COM",
            EmailConfirmed = true,
            TenantId = Guid.NewGuid(),
            IsActive = true,
            FirstName = "Dup",
            LastName = "User",
        });
        await db.SaveChangesAsync();

        var request = new CreatePlatformOrganizationRequest
        {
            Name = "Should Fail Org",
            FirstAdminEmail = "dup@example.com",
        };

        // Act
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateAsync(request, createdBy));

        // Assert
        Assert.Contains("already registered", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ResendFirstAdminInviteAsync_ExtendsExpiryAndReturnsPending()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Resend Tenant");
        var createdBy = Guid.NewGuid();

        var invite = InviteToken.Create(
            "admin@example.com",
            tenant.Id,
            PlatformRole.OrgAdmin,
            createdBy,
            expiryDays: 1);

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var beforeExpires = invite.ExpiresAt;

        // Act
        var dto = await service.ResendFirstAdminInviteAsync(
            tenant.Id,
            platformAdminUserId: Guid.NewGuid());

        // Assert
        Assert.NotNull(dto);
        Assert.Equal("pending", dto!.Status);
        Assert.True(dto.ExpiresAt > beforeExpires);
        Assert.NotNull(dto.InviteLink);
    }

    [Fact]
    public async Task RevokePendingFirstAdminInvitesAsync_SoftRevokesAllPending()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Revoke Tenant");
        var createdBy = Guid.NewGuid();

        var invite1 = InviteToken.Create(
            "admin1@example.com",
            tenant.Id,
            PlatformRole.OrgAdmin,
            createdBy);
        var invite2 = InviteToken.Create(
            "admin2@example.com",
            tenant.Id,
            PlatformRole.OrgAdmin,
            createdBy);

        var accepted = InviteToken.Create(
            "accepted@example.com",
            tenant.Id,
            PlatformRole.OrgAdmin,
            createdBy);
        accepted.MarkAccepted(Guid.NewGuid());

        db.Tenants.Add(tenant);
        db.InviteTokens.AddRange(invite1, invite2, accepted);
        await db.SaveChangesAsync();

        // Act
        var ok = await service.RevokePendingFirstAdminInvitesAsync(tenant.Id);

        // Assert
        Assert.True(ok);

        // Records still exist but are soft-revoked
        var allInvites = db.InviteTokens
            .Where(i => i.TenantId == tenant.Id && i.Role == PlatformRole.OrgAdmin)
            .ToList();
        Assert.Equal(3, allInvites.Count);

        // No active pending invites remain
        var activePending = allInvites
            .Where(i => i.AcceptedAt == null && !i.IsRevoked)
            .ToList();
        Assert.Empty(activePending);

        // The revoked ones have timestamps
        var revoked = allInvites.Where(i => i.IsRevoked).ToList();
        Assert.Equal(2, revoked.Count);
        Assert.All(revoked, i => Assert.NotNull(i.RevokedAt));
    }

    [Fact]
    public async Task UpdateAsync_UpdatesNameOnly()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Original Name");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var request = new UpdatePlatformOrganizationRequest { Name = "Updated Name" };

        // Act
        var result = await service.UpdateAsync(tenant.Id, request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Updated Name", result!.Name);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesInternalNotesOnly()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Notes Org");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var request = new UpdatePlatformOrganizationRequest { InternalNotes = "Some admin notes" };

        // Act
        var result = await service.UpdateAsync(tenant.Id, request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Some admin notes", result!.InternalNotes);
        Assert.Equal("Notes Org", result.Name);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesNameAndNotes()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Both Org");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var request = new UpdatePlatformOrganizationRequest
        {
            Name = "New Name",
            InternalNotes = "New notes"
        };

        // Act
        var result = await service.UpdateAsync(tenant.Id, request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("New Name", result!.Name);
        Assert.Equal("New notes", result.InternalNotes);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenTenantNotFound()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var request = new UpdatePlatformOrganizationRequest { Name = "Nonexistent" };

        // Act
        var result = await service.UpdateAsync(Guid.NewGuid(), request);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task ListAsync_StatsIncludeActiveOrganizations()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var activeTenant = Tenant.Create("Active Org");
        var draftTenant = Tenant.Create("Draft Org");

        var hrRole = new IdentityRole<Guid>
        {
            Id = Guid.NewGuid(),
            Name = PlatformRole.OrgAdmin,
            NormalizedName = PlatformRole.OrgAdmin.ToUpperInvariant(),
        };

        var hrAdmin = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "admin@active.com",
            Email = "admin@active.com",
            NormalizedEmail = "ADMIN@ACTIVE.COM",
            EmailConfirmed = true,
            TenantId = activeTenant.Id,
            IsActive = true,
            FirstName = "Hr",
            LastName = "Admin",
        };

        db.Tenants.AddRange(activeTenant, draftTenant);
        db.Roles.Add(hrRole);
        db.Users.Add(hrAdmin);
        db.UserRoles.Add(new IdentityUserRole<Guid>
        {
            UserId = hrAdmin.Id,
            RoleId = hrRole.Id
        });
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });

        // Assert
        Assert.Equal(2, paged.Stats.TotalOrganizations);
        Assert.Equal(1, paged.Stats.ActiveOrganizations);
    }

    // ---- Suspend / Reactivate / Archive service tests ----

    [Fact]
    public async Task SuspendAsync_SuspendsTenant_ReturnsTrue()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Suspend Me");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var ok = await service.SuspendAsync(tenant.Id);
        Assert.True(ok);

        var reloaded = await db.Tenants.FindAsync(tenant.Id);
        Assert.False(reloaded!.IsActive);
    }

    [Fact]
    public async Task SuspendAsync_ReturnsFalse_WhenNotFound()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var ok = await service.SuspendAsync(Guid.NewGuid());
        Assert.False(ok);
    }

    [Fact]
    public async Task SuspendAsync_Throws_WhenAlreadySuspended()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Already Suspended");
        tenant.Deactivate();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SuspendAsync(tenant.Id));
    }

    [Fact]
    public async Task ReactivateAsync_ReactivatesTenant_ReturnsTrue()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Reactivate Me");
        tenant.Deactivate();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var ok = await service.ReactivateAsync(tenant.Id);
        Assert.True(ok);

        var reloaded = await db.Tenants.FindAsync(tenant.Id);
        Assert.True(reloaded!.IsActive);
    }

    [Fact]
    public async Task ReactivateAsync_ReturnsFalse_WhenNotFound()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var ok = await service.ReactivateAsync(Guid.NewGuid());
        Assert.False(ok);
    }

    [Fact]
    public async Task ReactivateAsync_Throws_WhenAlreadyActive()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Already Active");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ReactivateAsync(tenant.Id));
    }

    [Fact]
    public async Task ArchiveAsync_ArchivesTenant_ReturnsTrue()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Archive Me");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var ok = await service.ArchiveAsync(tenant.Id);
        Assert.True(ok);

        var reloaded = await db.Tenants.FindAsync(tenant.Id);
        Assert.True(reloaded!.IsArchived);
        Assert.False(reloaded.IsActive);
    }

    [Fact]
    public async Task ArchiveAsync_ReturnsFalse_WhenNotFound()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var ok = await service.ArchiveAsync(Guid.NewGuid());
        Assert.False(ok);
    }

    [Fact]
    public async Task ArchiveAsync_Throws_WhenAlreadyArchived()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Already Archived");
        tenant.Archive();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ArchiveAsync(tenant.Id));
    }

    // ---- GetAsync service tests ----

    [Fact]
    public async Task GetAsync_ReturnsDetail_WhenTenantExists()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Detail Org");
        tenant.SetInternalNotes("Admin notes");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var detail = await service.GetAsync(tenant.Id);

        Assert.NotNull(detail);
        Assert.Equal("Detail Org", detail!.Name);
        Assert.Equal("Admin notes", detail.InternalNotes);
        Assert.Equal("draft", detail.OperationalStatus);
    }

    [Fact]
    public async Task GetAsync_ReturnsNull_WhenTenantNotFound()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var detail = await service.GetAsync(Guid.NewGuid());
        Assert.Null(detail);
    }

    // ---- ListAsync search / filter / sort / pagination tests ----

    [Fact]
    public async Task ListAsync_SearchByName_FiltersResults()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        db.Tenants.AddRange(
            Tenant.Create("Acme Corp"),
            Tenant.Create("Beta Inc"),
            Tenant.Create("Acme Labs"));
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, Search = "acme"
        });

        Assert.Equal(2, paged.TotalCount);
        Assert.All(paged.Items, i => Assert.Contains("Acme", i.Name));
    }

    [Fact]
    public async Task ListAsync_FilterByStatus_FiltersCorrectly()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var active = Tenant.Create("Active T");
        var draft = Tenant.Create("Draft T");
        var suspended = Tenant.Create("Suspended T");
        suspended.Deactivate();

        db.Tenants.AddRange(active, draft, suspended);
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, FilterByStatus = ["suspended"]
        });

        Assert.Single(paged.Items);
        Assert.Equal("suspended", paged.Items[0].OperationalStatus);
    }

    [Fact]
    public async Task ListAsync_SortByName_Ascending()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        db.Tenants.AddRange(
            Tenant.Create("Charlie"),
            Tenant.Create("Alpha"),
            Tenant.Create("Bravo"));
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, OrderBy = "name", OrderDirection = "asc"
        });

        Assert.Equal("Alpha", paged.Items[0].Name);
        Assert.Equal("Bravo", paged.Items[1].Name);
        Assert.Equal("Charlie", paged.Items[2].Name);
    }

    [Fact]
    public async Task ListAsync_Pagination_ReturnsCorrectPage()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        for (int i = 0; i < 5; i++)
            db.Tenants.Add(Tenant.Create($"Org {i}"));
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 2, Take = 2
        });

        Assert.Equal(5, paged.TotalCount);
        Assert.Equal(2, paged.Items.Count);
    }

    // ---- CreateAsync edge cases ----

    [Fact]
    public async Task CreateAsync_WithInternalNotes_SetsNotes()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var request = new CreatePlatformOrganizationRequest
        {
            Name = "Notes Org",
            FirstAdminEmail = "admin@notes.com",
            InternalNotes = "Important client"
        };

        var created = await service.CreateAsync(request, Guid.NewGuid());
        Assert.Equal("Important client", created.Organization.InternalNotes);
    }

    [Fact]
    public async Task CreateAsync_Throws_WhenDuplicateName()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var request1 = new CreatePlatformOrganizationRequest
        {
            Name = "UniqueOrg",
            FirstAdminEmail = "admin1@uniq.com",
        };
        await service.CreateAsync(request1, Guid.NewGuid());

        var request2 = new CreatePlatformOrganizationRequest
        {
            Name = "uniqueorg", // case-insensitive duplicate
            FirstAdminEmail = "admin2@uniq.com",
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateAsync(request2, Guid.NewGuid()));
        Assert.Contains("already exists", ex.Message);
    }

    // ---- Resend / Revoke edge cases ----

    [Fact]
    public async Task ResendFirstAdminInviteAsync_ReturnsNull_WhenNoPendingInvite()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("No Invite Tenant");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var result = await service.ResendFirstAdminInviteAsync(tenant.Id, Guid.NewGuid());
        Assert.Null(result);
    }

    [Fact]
    public async Task RevokePendingFirstAdminInvitesAsync_ReturnsFalse_WhenNoPending()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("No Pending Tenant");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var ok = await service.RevokePendingFirstAdminInvitesAsync(tenant.Id);
        Assert.False(ok);
    }

    [Fact]
    public async Task RevokePendingFirstAdminInvitesAsync_ExcludesAlreadyRevoked()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Double Revoke Tenant");
        var createdBy = Guid.NewGuid();
        var invite = InviteToken.Create("admin@dr.com", tenant.Id, PlatformRole.OrgAdmin, createdBy);

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        // First revoke succeeds
        Assert.True(await service.RevokePendingFirstAdminInvitesAsync(tenant.Id));

        // Second revoke returns false — nothing pending
        Assert.False(await service.RevokePendingFirstAdminInvitesAsync(tenant.Id));
    }

    // ---- ListAsync additional edge cases ----

    [Fact]
    public async Task ListAsync_SortByName_Descending()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        db.Tenants.AddRange(
            Tenant.Create("Alpha"),
            Tenant.Create("Bravo"),
            Tenant.Create("Charlie"));
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, OrderBy = "name", OrderDirection = "desc"
        });

        Assert.Equal("Charlie", paged.Items[0].Name);
        Assert.Equal("Bravo", paged.Items[1].Name);
        Assert.Equal("Alpha", paged.Items[2].Name);
    }

    [Fact]
    public async Task ListAsync_SortByCreatedAt_Ascending()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var t1 = Tenant.Create("First");
        SetPrivateProperty(t1, "CreatedAt", DateTime.UtcNow.AddDays(-3));
        var t2 = Tenant.Create("Second");
        SetPrivateProperty(t2, "CreatedAt", DateTime.UtcNow.AddDays(-2));
        var t3 = Tenant.Create("Third");
        SetPrivateProperty(t3, "CreatedAt", DateTime.UtcNow.AddDays(-1));

        db.Tenants.AddRange(t1, t2, t3);
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, OrderBy = "createdAt", OrderDirection = "asc"
        });

        Assert.Equal("First", paged.Items[0].Name);
        Assert.Equal("Second", paged.Items[1].Name);
        Assert.Equal("Third", paged.Items[2].Name);
    }

    [Fact]
    public async Task ListAsync_DefaultSort_IsCreatedAtDescending()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var t1 = Tenant.Create("First");
        SetPrivateProperty(t1, "CreatedAt", DateTime.UtcNow.AddDays(-3));
        var t2 = Tenant.Create("Second");
        SetPrivateProperty(t2, "CreatedAt", DateTime.UtcNow.AddDays(-2));
        var t3 = Tenant.Create("Third");
        SetPrivateProperty(t3, "CreatedAt", DateTime.UtcNow.AddDays(-1));

        db.Tenants.AddRange(t1, t2, t3);
        await db.SaveChangesAsync();

        // No orderBy specified — default is createdAt desc
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100
        });

        Assert.Equal("Third", paged.Items[0].Name);
        Assert.Equal("Second", paged.Items[1].Name);
        Assert.Equal("First", paged.Items[2].Name);
    }

    [Fact]
    public async Task ListAsync_FilterByMultipleStatuses()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var draft = Tenant.Create("Draft T");
        var suspended = Tenant.Create("Suspended T");
        suspended.Deactivate();
        var archived = Tenant.Create("Archived T");
        archived.Archive();

        db.Tenants.AddRange(draft, suspended, archived);
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, FilterByStatus = ["suspended", "archived"]
        });

        Assert.Equal(2, paged.Items.Count);
        Assert.All(paged.Items, i =>
            Assert.True(i.OperationalStatus == "suspended" || i.OperationalStatus == "archived"));
    }

    [Fact]
    public async Task ListAsync_Search_NoMatches_ReturnsEmpty()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        db.Tenants.AddRange(Tenant.Create("Acme Corp"), Tenant.Create("Beta Inc"));
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100, Search = "nonexistent"
        });

        Assert.Empty(paged.Items);
        Assert.Equal(0, paged.TotalCount);
        // Stats are unaffected by search — they always show global stats
        Assert.Equal(2, paged.Stats.TotalOrganizations);
    }

    [Fact]
    public async Task ListAsync_EmptyDatabase_ReturnsEmptyWithZeroStats()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 100
        });

        Assert.Empty(paged.Items);
        Assert.Equal(0, paged.TotalCount);
        Assert.Equal(0, paged.Stats.TotalOrganizations);
        Assert.Equal(0, paged.Stats.InvitedPending);
        Assert.Equal(0, paged.Stats.ActiveOrganizations);
    }

    [Fact]
    public async Task ListAsync_TakeClampedTo100()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        for (int i = 0; i < 3; i++)
            db.Tenants.Add(Tenant.Create($"Org {i}"));
        await db.SaveChangesAsync();

        // Request take=200, should be clamped to 100 (but only 3 exist)
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = 0, Take = 200
        });

        Assert.Equal(3, paged.TotalCount);
        Assert.Equal(3, paged.Items.Count);
    }

    [Fact]
    public async Task ListAsync_NegativeSkip_TreatedAsZero()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        db.Tenants.Add(Tenant.Create("Single Org"));
        await db.SaveChangesAsync();

        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto
        {
            Skip = -5, Take = 10
        });

        Assert.Single(paged.Items);
    }

    // ---- GetAsync with invite states ----

    [Fact]
    public async Task GetAsync_WithPendingInvite_ShowsPendingStatus()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Pending Invite Org");
        var invite = InviteToken.Create(
            "admin@pending.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid());

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var detail = await service.GetAsync(tenant.Id);

        Assert.NotNull(detail);
        Assert.Equal("invited", detail!.OperationalStatus);
        Assert.NotNull(detail.FirstAdminInvite);
        Assert.Equal("pending", detail.FirstAdminInvite.Status);
        Assert.Equal("admin@pending.com", detail.FirstAdminInvite.Email);
        Assert.NotNull(detail.FirstAdminInvite.InviteLink);
    }

    [Fact]
    public async Task GetAsync_WithAcceptedInvite_ShowsAcceptedStatus()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Accepted Invite Org");
        var invite = InviteToken.Create(
            "admin@accepted.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid());
        invite.MarkAccepted(Guid.NewGuid());

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var detail = await service.GetAsync(tenant.Id);

        Assert.NotNull(detail);
        Assert.NotNull(detail!.FirstAdminInvite);
        Assert.Equal("accepted", detail.FirstAdminInvite.Status);
        Assert.Null(detail.FirstAdminInvite.InviteLink); // no link for accepted
    }

    [Fact]
    public async Task GetAsync_WithExpiredInvite_ShowsExpiredStatus()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Expired Invite Org");
        var invite = InviteToken.Create(
            "admin@expired.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid(), expiryDays: 1);
        SetPrivateProperty(invite, "ExpiresAt", DateTime.UtcNow.AddMinutes(-1));

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var detail = await service.GetAsync(tenant.Id);

        Assert.NotNull(detail);
        Assert.NotNull(detail!.FirstAdminInvite);
        Assert.Equal("expired", detail.FirstAdminInvite.Status);
        Assert.Null(detail.FirstAdminInvite.InviteLink); // no link for expired
    }

    [Fact]
    public async Task GetAsync_WithNoInvites_ShowsNoneStatus()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("No Invite Org");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var detail = await service.GetAsync(tenant.Id);

        Assert.NotNull(detail);
        Assert.Equal("draft", detail!.OperationalStatus);
        Assert.NotNull(detail.FirstAdminInvite);
        Assert.Equal("none", detail.FirstAdminInvite.Status);
        Assert.Null(detail.FirstAdminInvite.InviteLink);
        Assert.Null(detail.FirstAdminInvite.Email);
    }

    [Fact]
    public async Task GetAsync_WithRevokedInvites_ShowsNoneStatus()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Revoked Invite Org");
        var invite = InviteToken.Create(
            "admin@revoked.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid());
        invite.Revoke();

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var detail = await service.GetAsync(tenant.Id);

        Assert.NotNull(detail);
        // Revoked invites are excluded from HrInvites (filtered by !IsRevoked in metrics)
        Assert.NotNull(detail!.FirstAdminInvite);
        Assert.Equal("none", detail.FirstAdminInvite.Status);
    }

    // ---- UpdateAsync edge cases ----

    [Fact]
    public async Task UpdateAsync_DuplicateName_Throws()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant1 = Tenant.Create("Existing Org");
        var tenant2 = Tenant.Create("To Be Renamed");
        db.Tenants.AddRange(tenant1, tenant2);
        await db.SaveChangesAsync();

        var request = new UpdatePlatformOrganizationRequest { Name = "existing org" }; // case-insensitive dup

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.UpdateAsync(tenant2.Id, request));
        Assert.Contains("already exists", ex.Message);
    }

    [Fact]
    public async Task UpdateAsync_SameNameAsSelf_Succeeds()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Keep Me");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Updating to the same name should not throw (self-reference excluded from dup check)
        var request = new UpdatePlatformOrganizationRequest { Name = "Keep Me" };
        var result = await service.UpdateAsync(tenant.Id, request);

        Assert.NotNull(result);
        Assert.Equal("Keep Me", result!.Name);
    }

    [Fact]
    public async Task UpdateAsync_ClearsInternalNotes_WhenSetToEmpty()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Notes Clear Org");
        tenant.SetInternalNotes("Old notes");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var request = new UpdatePlatformOrganizationRequest { InternalNotes = "" };
        var result = await service.UpdateAsync(tenant.Id, request);

        Assert.NotNull(result);
        Assert.Null(result!.InternalNotes); // empty string clears notes (domain trims to null)
    }

    // ---- Lifecycle on archived tenant ----

    [Fact]
    public async Task SuspendAsync_WhenArchived_Throws()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Archived for Suspend");
        tenant.Archive();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SuspendAsync(tenant.Id));
    }

    [Fact]
    public async Task ReactivateAsync_WhenArchived_Throws()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Archived for Reactivate");
        tenant.Archive();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ReactivateAsync(tenant.Id));
    }

    // ---- ResendInvite edge cases ----

    [Fact]
    public async Task ResendFirstAdminInviteAsync_ExtendsExpiredInvite()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Expired Invite Tenant");
        var invite = InviteToken.Create(
            "admin@expired.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid(), expiryDays: 1);

        // Expire the invite via reflection (private setter)
        var expiresAtProp = invite.GetType().GetProperty("ExpiresAt")!;
        expiresAtProp.GetSetMethod(true)!.Invoke(invite, [DateTime.UtcNow.AddMinutes(-30)]);

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var result = await service.ResendFirstAdminInviteAsync(tenant.Id, Guid.NewGuid());

        Assert.NotNull(result);
        Assert.Equal("pending", result!.Status);
        Assert.NotNull(result.InviteLink);
        // ExpiresAt should have been extended forward from the expired past value
        Assert.NotNull(result.ExpiresAt);
        Assert.True(result.ExpiresAt > DateTime.UtcNow,
            $"Expected ExpiresAt to be in the future after resend, but was {result.ExpiresAt}");
    }

    [Fact]
    public async Task ResendFirstAdminInviteAsync_IgnoresAcceptedInvites()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Accepted Only Tenant");
        var invite = InviteToken.Create(
            "admin@accepted.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid());
        invite.MarkAccepted(Guid.NewGuid());

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var result = await service.ResendFirstAdminInviteAsync(tenant.Id, Guid.NewGuid());

        Assert.Null(result); // no pending invite to resend
    }

    [Fact]
    public async Task ResendFirstAdminInviteAsync_IgnoresRevokedInvites()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var tenant = Tenant.Create("Revoked Only Tenant");
        var invite = InviteToken.Create(
            "admin@revoked.com", tenant.Id, PlatformRole.OrgAdmin, Guid.NewGuid());
        invite.Revoke();

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var result = await service.ResendFirstAdminInviteAsync(tenant.Id, Guid.NewGuid());

        Assert.Null(result); // revoked invite is not resendable
    }

    // ---- CreateAsync edge cases ----

    [Fact]
    public async Task CreateAsync_WithoutInternalNotes_OmitsNotes()
    {
        var db = CreateDbContext();
        var service = new PlatformOrganizationService(db, CreateConfiguration());

        var request = new CreatePlatformOrganizationRequest
        {
            Name = "No Notes Org",
            FirstAdminEmail = "admin@nonotes.com",
        };

        var created = await service.CreateAsync(request, Guid.NewGuid());
        Assert.Null(created.Organization.InternalNotes);
    }

    private static AppIdentityDbContext CreateDbContext(string? databaseName = null)
    {
        var dbName = databaseName ?? $"PlatformAdmin_{Guid.NewGuid()}";

        var options = new DbContextOptionsBuilder<AppIdentityDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var db = new AppIdentityDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private static IConfiguration CreateConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Application:PublicBaseUrl"] = "http://localhost:3000",
            })
            .Build();
    }

    private static void SetPrivateProperty<T>(T instance, string propertyName, object value)
    {
        var prop = instance!.GetType().GetProperty(
            propertyName,
            BindingFlags.Instance | BindingFlags.Public);

        if (prop is null)
            throw new InvalidOperationException($"Property '{propertyName}' not found.");

        var setter = prop.GetSetMethod(true);
        if (setter is null)
            throw new InvalidOperationException($"No setter for '{propertyName}'.");

        setter.Invoke(instance, new[] { value });
    }

    private sealed class RecordingPerformanceProvisioningClient : IPerformanceProvisioningClient
    {
        public Guid? ProvisionedTenantId { get; private set; }
        public int CallCount { get; private set; }

        public Task ProvisionAsync(Guid tenantId, CancellationToken cancellationToken = default)
        {
            ProvisionedTenantId = tenantId;
            CallCount++;
            return Task.CompletedTask;
        }
    }
}

