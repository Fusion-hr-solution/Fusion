using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ActivateTenantSetup;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSetup;

public class ActivateTenantSetupCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task Handle_WithNoSetupState_CreatesActivatedState()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new ActivateTenantSetupCommandHandler(
            context,
            tenantContext,
            StubIdentityTenantStatusReader.Active());

        var result = await handler.Handle(new ActivateTenantSetupCommand(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("activated", result.Value.CurrentPhase);
        Assert.True(result.Value.CanResumeSetup);

        var saved = await context.TenantSetupStates.IgnoreQueryFilters().FirstOrDefaultAsync();
        Assert.NotNull(saved);
        Assert.Equal(TenantId, saved.TenantId);
        Assert.NotNull(saved.ActivatedAt);
    }

    [Fact]
    public async Task Handle_WithExistingSetupState_IsIdempotent()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var originalState = await context.TenantSetupStates.AsNoTracking().FirstAsync();
        var handler = new ActivateTenantSetupCommandHandler(
            context,
            tenantContext,
            StubIdentityTenantStatusReader.Suspended());

        var result = await handler.Handle(new ActivateTenantSetupCommand(), CancellationToken.None);
        var persisted = await context.TenantSetupStates.AsNoTracking().FirstAsync();

        Assert.True(result.IsSuccess);
        Assert.Equal("activated", result.Value.CurrentPhase);
        Assert.Equal(originalState.ActivatedAt, persisted.ActivatedAt);
    }

    [Fact]
    public async Task Handle_WithSuspendedTenant_ThrowsInvalidTenantActivationStateException()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new ActivateTenantSetupCommandHandler(
            context,
            tenantContext,
            StubIdentityTenantStatusReader.Suspended());

        await Assert.ThrowsAsync<InvalidTenantActivationStateException>(
            () => handler.Handle(new ActivateTenantSetupCommand(), CancellationToken.None));
    }

    private sealed class StubIdentityTenantStatusReader(IdentityTenantOperationalStatusDto status)
        : IIdentityTenantStatusReader
    {
        public static StubIdentityTenantStatusReader Active()
            => new(new IdentityTenantOperationalStatusDto(TenantId, "active", true, false));

        public static StubIdentityTenantStatusReader Suspended()
            => new(new IdentityTenantOperationalStatusDto(TenantId, "suspended", false, false));

        public Task<IdentityTenantOperationalStatusDto> GetCurrentTenantStatusAsync(CancellationToken cancellationToken)
            => Task.FromResult(status);
    }
}