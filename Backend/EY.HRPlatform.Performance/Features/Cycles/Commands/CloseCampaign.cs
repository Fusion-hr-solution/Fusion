using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

/// <summary>
/// HR closes a campaign explicitly — for a cycle that was abandoned, or never evaluated, and so will
/// never satisfy the automatic condition.
/// </summary>
/// <remarks>
/// Gated by <c>performance.cycle.publish</c> at Tenant scope (design D4): closing is an operational
/// transition of the same kind as launching, performed by the same role on the same object, so it
/// reuses that door rather than minting a permission to express a distinction nobody asked for.
/// </remarks>
public sealed record CloseCampaignCommand(
    ClaimsPrincipal Actor,
    Guid CycleId,
    uint ExpectedVersion,
    bool ConfirmOutstandingWork)
    : ICommand<Result<CampaignClosureResultDto>>;

public sealed class CloseCampaignCommandHandler(
    PerformanceDbContext dbContext,
    CampaignClosureEligibilityResolver eligibility,
    CampaignCloser closer)
    : ICommandHandler<CloseCampaignCommand, Result<CampaignClosureResultDto>>
{
    public const string OutstandingWorkNeedsConfirmationCode = "Performance.Campaign.OutstandingWork";

    public async Task<Result<CampaignClosureResultDto>> Handle(
        CloseCampaignCommand command,
        CancellationToken cancellationToken)
    {
        var campaign = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(candidate => candidate.Id == command.CycleId, cancellationToken);

        if (campaign is null)
        {
            return Result.Failure<CampaignClosureResultDto>(
                Error.NotFound("PerformanceCycle", command.CycleId));
        }

        if (campaign.Status == PerformanceCycleStatus.Draft)
        {
            return Result.Failure<CampaignClosureResultDto>(Error.Conflict(
                "Performance.Campaign.NeverLaunched",
                "This campaign was never launched. Delete it instead of closing it."));
        }

        if (campaign.IsClosed)
        {
            // Already the intended end state, and closure is terminal — report it rather than
            // producing a second closure record.
            return Result.Failure<CampaignClosureResultDto>(CampaignClosureErrors.CampaignClosed());
        }

        ConcurrencyGuard.Ensure(campaign.Version, command.ExpectedVersion,
            nameof(Domain.Entities.PerformanceCycle), campaign.Id);

        var outstanding = await eligibility.ResolveOutstandingWorkAsync(command.CycleId, cancellationToken);

        // HR sees what closing now would leave unfinished, and closes anyway on confirmation.
        if (outstanding.HasOutstandingWork && !command.ConfirmOutstandingWork)
        {
            return Result.Failure<CampaignClosureResultDto>(new Error(
                OutstandingWorkNeedsConfirmationCode,
                "This campaign still has outstanding work. Confirm to close it anyway.",
                outstanding));
        }

        await closer.StageCloseAsync(
            command.CycleId,
            CampaignClosureKind.Manual,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            DateTime.UtcNow,
            cancellationToken);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Two simultaneous closes: the row version makes exactly one of them win, and the loser
            // is told the campaign is already closed rather than writing a second record.
            throw new Exceptions.ConcurrencyException(
                nameof(Domain.Entities.PerformanceCycle), campaign.Id);
        }

        return Result.Success(new CampaignClosureResultDto(
            campaign.Id,
            campaign.ClosedAt!.Value,
            campaign.ClosureKind!.Value.ToString(),
            campaign.ClosedByName,
            outstanding,
            campaign.Version));
    }
}

/// <summary>
/// What HR would leave unfinished by closing now. Read-only; asking does not close anything.
/// </summary>
public sealed record GetCampaignClosureImpactQuery(Guid CycleId)
    : IQuery<Result<CampaignClosureImpactDto>>;

public sealed class GetCampaignClosureImpactQueryHandler(
    PerformanceDbContext dbContext,
    CampaignClosureEligibilityResolver eligibility)
    : IQueryHandler<GetCampaignClosureImpactQuery, Result<CampaignClosureImpactDto>>
{
    public async Task<Result<CampaignClosureImpactDto>> Handle(
        GetCampaignClosureImpactQuery request,
        CancellationToken cancellationToken)
    {
        var campaign = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(candidate => candidate.Id == request.CycleId)
            .Select(candidate => new { candidate.Id, candidate.Status, candidate.Version })
            .FirstOrDefaultAsync(cancellationToken);

        if (campaign is null)
        {
            return Result.Failure<CampaignClosureImpactDto>(
                Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var outstanding = await eligibility.ResolveOutstandingWorkAsync(request.CycleId, cancellationToken);
        var eligibleAutomatically = await eligibility.IsEligibleForAutomaticClosureAsync(
            request.CycleId, cancellationToken);

        return Result.Success(new CampaignClosureImpactDto(
            campaign.Id,
            campaign.Status == PerformanceCycleStatus.Closed,
            eligibleAutomatically,
            outstanding,
            campaign.Version));
    }
}
