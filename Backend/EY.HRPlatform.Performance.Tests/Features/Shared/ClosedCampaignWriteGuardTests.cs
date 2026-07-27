using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Performance.Tests.Features.Shared;

/// <summary>
/// Read-only archive semantics, enforced at the pipeline rather than per handler: a campaign-scoped
/// write against a closed campaign is rejected before the handler runs, while every read still
/// answers with the state as it stood at closure.
/// </summary>
public sealed class ClosedCampaignWriteGuardTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(Guid TenantId, string DbName, Guid ClosedCycleId, Guid OpenCycleId, int ParticipantCount);

    private static async Task<Seeded> SeedAsync()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"closed-guard-{Guid.NewGuid()}";

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);

        var closed = TestCycles.Create(tenantId, "FY25", PerformanceCycleType.Annual,
            Start.AddYears(-1), Start, objectiveSettingDeadline: Start.AddYears(-1).AddDays(30)).ForceLaunched();
        var open = TestCycles.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            Start, Start.AddYears(1), objectiveSettingDeadline: Start.AddDays(30)).ForceLaunched();

        db.PerformanceCycles.AddRange(closed, open);

        for (var i = 0; i < 3; i++)
        {
            db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(
                tenantId, closed.Id, Guid.NewGuid(), $"Archived Employee {i}", Guid.NewGuid(), "Mgr"));
        }

        closed.Close(CampaignClosureKind.Automatic, Guid.NewGuid(), "HR Admin", Start.AddDays(-1));
        await db.SaveChangesAsync();

        return new Seeded(tenantId, dbName, closed.Id, open.Id, 3);
    }

    private sealed record CampaignScopedProbe(Guid CycleId) : SharedKernel.CQRS.ICommand<Result<string>>;

    private static async Task<(Result<string> Response, bool HandlerRan)> InvokeAsync(Seeded seeded, Guid cycleId)
    {
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var behavior = new ClosedCampaignWriteBehavior<CampaignScopedProbe, Result<string>>(
            new CampaignWriteGuard(db),
            NullLogger<ClosedCampaignWriteBehavior<CampaignScopedProbe, Result<string>>>.Instance);

        var handlerRan = false;
        var response = await behavior.Handle(
            new CampaignScopedProbe(cycleId),
            _ =>
            {
                handlerRan = true;
                return Task.FromResult(Result.Success("wrote"));
            },
            CancellationToken.None);

        return (response, handlerRan);
    }

    [Fact]
    public async Task A_write_against_a_closed_campaign_is_rejected_before_the_handler_runs()
    {
        var seeded = await SeedAsync();

        var (response, handlerRan) = await InvokeAsync(seeded, seeded.ClosedCycleId);

        Assert.True(response.IsFailure);
        Assert.Equal(CampaignClosureErrors.CampaignClosedCode, response.Error.Code);

        // Rejection precedes the handler, so nothing was resolved, written, or partially applied.
        Assert.False(handlerRan);
    }

    [Fact]
    public async Task A_write_against_an_open_campaign_proceeds_untouched()
    {
        var seeded = await SeedAsync();

        var (response, handlerRan) = await InvokeAsync(seeded, seeded.OpenCycleId);

        Assert.True(response.IsSuccess);
        Assert.True(handlerRan);
    }

    [Fact]
    public async Task A_campaign_in_another_tenant_answers_as_not_found_rather_than_as_closed()
    {
        var seeded = await SeedAsync();

        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _, seeded.DbName);
        var guard = new CampaignWriteGuard(db);

        // The tenant filter hides it entirely; a cross-tenant caller learns nothing about its state.
        Assert.False(await guard.IsClosedAsync(seeded.ClosedCycleId, CancellationToken.None));
    }

    [Fact]
    public async Task Reads_still_return_the_archive_as_it_stood_at_closure()
    {
        var seeded = await SeedAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);

        var closed = db.PerformanceCycles.Single(cycle => cycle.Id == seeded.ClosedCycleId);
        var participants = db.PerformanceCycleParticipants
            .Count(participant => participant.CycleId == seeded.ClosedCycleId);

        Assert.Equal(PerformanceCycleStatus.Closed, closed.Status);
        Assert.NotNull(closed.ClosedAt);

        // Nothing is deleted or redacted by closing.
        Assert.Equal(seeded.ParticipantCount, participants);
    }

    [Fact]
    public async Task An_unknown_subject_is_left_to_the_handlers_own_not_found_path()
    {
        var seeded = await SeedAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var guard = new CampaignWriteGuard(db);

        // The guard must not answer "closed" for something that simply does not exist.
        Assert.False(await guard.IsClosedForRoundAsync(Guid.NewGuid(), CancellationToken.None));
        Assert.False(await guard.IsClosedForPlanAsync(Guid.NewGuid(), CancellationToken.None));
        Assert.False(await guard.IsClosedForCheckInAsync(Guid.NewGuid(), CancellationToken.None));
        Assert.False(await guard.IsClosedForAssignmentAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task A_query_is_never_gated_by_closure()
    {
        var seeded = await SeedAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var behavior = new ClosedCampaignWriteBehavior<QueryProbe, Result<string>>(
            new CampaignWriteGuard(db),
            NullLogger<ClosedCampaignWriteBehavior<QueryProbe, Result<string>>>.Instance);

        var response = await behavior.Handle(
            new QueryProbe(seeded.ClosedCycleId),
            _ => Task.FromResult(Result.Success("read")),
            CancellationToken.None);

        Assert.True(response.IsSuccess);
    }

    private sealed record QueryProbe(Guid CycleId) : SharedKernel.CQRS.IQuery<Result<string>>;

    [Fact]
    public async Task An_exempt_command_is_permitted_against_a_closed_campaign()
    {
        var seeded = await SeedAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var behavior = new ClosedCampaignWriteBehavior<ExemptProbe, Result<string>>(
            new CampaignWriteGuard(db),
            NullLogger<ClosedCampaignWriteBehavior<ExemptProbe, Result<string>>>.Instance);

        var response = await behavior.Handle(
            new ExemptProbe(seeded.ClosedCycleId),
            _ => Task.FromResult(Result.Success("acknowledged")),
            CancellationToken.None);

        Assert.True(response.IsSuccess);
    }

    [ClosedCampaignExempt("Test double for the acknowledgement exception.")]
    private sealed record ExemptProbe(Guid CycleId) : SharedKernel.CQRS.ICommand<Result<string>>;

    [Fact]
    public async Task A_valueless_command_result_also_carries_the_closure_code()
    {
        var seeded = await SeedAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var behavior = new ClosedCampaignWriteBehavior<UnitProbe, Result>(
            new CampaignWriteGuard(db),
            NullLogger<ClosedCampaignWriteBehavior<UnitProbe, Result>>.Instance);

        var response = await behavior.Handle(
            new UnitProbe(seeded.ClosedCycleId),
            _ => Task.FromResult(Result.Success()),
            CancellationToken.None);

        Assert.True(response.IsFailure);
        Assert.Equal(CampaignClosureErrors.CampaignClosedCode, response.Error.Code);
    }

    private sealed record UnitProbe(Guid CycleId) : SharedKernel.CQRS.ICommand<Result>;
}
