using System.Diagnostics;
using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using EY.HRPlatform.Identity.Features.WorkforceAccounts;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.Identity.Models.WorkforceAccounts;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit.Abstractions;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceAccounts;

public sealed class WorkforceBulkProvisionScaleTests(ITestOutputHelper output)
{
    [Fact]
    public async Task Four_hundred_twenty_invitations_produce_a_complete_receipt_without_real_delivery()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        db.Tenants.Add(Tenant.Create(tenantId, "Scale Test Organization"));
        await db.SaveChangesAsync();

        var userManager = RelationalTestDatabase.CreateUserManager(db);
        var accessProfiles = new AccessProfileService(db, userManager);
        await accessProfiles.EnsureTenantAccessProfilesAsync(tenantId);

        var controller = new WorkforceAccountsController(
            db,
            accessProfiles,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Application:PublicBaseUrl"] = "http://localhost:3000"
            }).Build(),
            new TenantContinuityCommandExecutor(db),
            new AlwaysAuthorizedInternalCaller(),
            new SuppressedDeliverySender())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        controller.Request.Headers["X-Tenant-Id"] = tenantId.ToString();
        controller.Request.Headers["X-Acting-User-Id"] = Guid.NewGuid().ToString();

        var request = new WorkforceAccountBulkProvisionRequest
        {
            Items = Enumerable.Range(0, 420).Select(index => new WorkforceAccountProvisionItemDto
            {
                EmployeeId = Guid.NewGuid(),
                Email = $"scale-{index:D3}@example.com",
                FirstName = "Scale",
                LastName = $"Person {index:D3}",
                Baseline = index % 10 == 0 ? "Manager" : "Employee"
            }).ToList()
        };

        var stopwatch = Stopwatch.StartNew();
        var result = await controller.BulkProvision(request, CancellationToken.None);
        stopwatch.Stop();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>>(ok.Value);
        Assert.NotNull(envelope.Data);
        Assert.Equal(request.Items.Count, envelope.Data.Count);
        Assert.Equal(request.Items.Select(item => item.EmployeeId), envelope.Data.Select(item => item.EmployeeId));
        Assert.All(envelope.Data, item => Assert.Equal("Created", item.Outcome));
        Assert.Equal(request.Items.Count, await db.InviteTokens.CountAsync());
        Assert.Equal(request.Items.Count, await db.InviteAccessProfiles.CountAsync());
        output.WriteLine($"420-person safe bulk execution: {stopwatch.ElapsedMilliseconds} ms");
    }

    private sealed class SuppressedDeliverySender : IWorkforceInvitationEmailSender
    {
        public Task<WorkforceInvitationDeliveryResult> SendInviteAsync(
            WorkforceInvitationEmailMessage invitation,
            CancellationToken cancellationToken)
            => Task.FromResult(WorkforceInvitationDeliveryResult.Suppressed("Scale-test delivery suppressed."));
    }

    private sealed class AlwaysAuthorizedInternalCaller : IInternalServiceRequestAuthorizer
    {
        public Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }
}
