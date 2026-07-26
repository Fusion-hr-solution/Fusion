using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class OverrideParticipantApproverCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private static async Task<(Guid CycleId, uint Version, string DbName)> SeedAsync()
    {
        var dbName = $"override-{Guid.NewGuid()}";
        await using var seed = PerformanceTestContext.Create(TenantId, out _, dbName);
        var cycle = TestCycles.Create(TenantId, "FY26 Override", PerformanceCycleType.Annual, Start, End);
        seed.PerformanceCycles.Add(cycle);
        await seed.SaveChangesAsync();
        return (cycle.Id, cycle.Version, dbName);
    }

    [Fact]
    public async Task Override_WithoutReason_ReturnsValidationFailure()
    {
        var (cycleId, version, dbName) = await SeedAsync();
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        var handler = new OverrideParticipantApproverCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), new FakeCoreWorkforceClient(), Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new OverrideParticipantApproverCommand(cycleId, version, Guid.NewGuid(), Guid.NewGuid(), ""), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.ApproverReasonRequired", result.Error.Code);
    }

    [Fact]
    public async Task Override_WithApproverNotInTenant_ReturnsValidationFailure()
    {
        var (cycleId, version, dbName) = await SeedAsync();
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        // Empty ResolvePool → the approver cannot be resolved as an active employee in the acting tenant.
        var handler = new OverrideParticipantApproverCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), new FakeCoreWorkforceClient(), Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new OverrideParticipantApproverCommand(cycleId, version, Guid.NewGuid(), Guid.NewGuid(), "Manager on leave"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.InvalidApprover", result.Error.Code);
    }

    [Fact]
    public async Task Override_WithInactiveApprover_ReturnsValidationFailure()
    {
        var (cycleId, version, dbName) = await SeedAsync();
        var approverId = Guid.NewGuid();
        var client = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                new CoreEmployeeSummary(approverId, "E-1", "Inactive Approver", "Inactive Approver",
                    "a@test.local", "Manager", IsActive: false, null, null)
            ]
        };
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        var handler = new OverrideParticipantApproverCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), client, Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new OverrideParticipantApproverCommand(cycleId, version, Guid.NewGuid(), approverId, "Reassigned"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.InvalidApprover", result.Error.Code);
    }

    [Fact]
    public async Task Override_OnCrossTenantCampaign_ReturnsNotFound()
    {
        var (cycleId, version, dbName) = await SeedAsync();
        var otherTenant = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(otherTenant, out var tenantContext, dbName);
        var approverId = Guid.NewGuid();
        var client = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                new CoreEmployeeSummary(approverId, "E-1", "Approver", "Approver", "a@test.local", "Manager", true, null, null)
            ]
        };
        var handler = new OverrideParticipantApproverCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), client, Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new OverrideParticipantApproverCommand(cycleId, version, Guid.NewGuid(), approverId, "Reassigned"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }
}
