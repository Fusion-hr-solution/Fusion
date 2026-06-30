using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;

public sealed record UpdateBaselineDraftCommand(
    ClaimsPrincipal Actor,
    CreateBaselineDraftRequest Request) : ICommand<Result<BaselineVersionDto>>;

public sealed class UpdateBaselineDraftCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateBaselineDraftCommand, Result<BaselineVersionDto>>
{
    public async Task<Result<BaselineVersionDto>> Handle(
        UpdateBaselineDraftCommand command,
        CancellationToken cancellationToken)
    {
        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline?.ActiveDraft is null)
            return Result.Failure<BaselineVersionDto>(
                new Error("PlatformBaseline.DraftNotFound", "No baseline Draft exists to update."));

        var req = command.Request;
        baseline.ActiveDraft.UpdateDraft(
            req.MaxObjectivesPerPlan,
            req.AllowedWeightValues,
            req.ManagerValidationSlaDays,
            req.CascadeMode,
            req.MeasurementTypes,
            req.AttachmentsEnabled);

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "BaselineDraftModified",
            "PlatformObjectiveBaseline",
            baseline.Id,
            versionNumber: baseline.ActiveDraft.VersionNumber,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetBaselineQueryHandler.ToDto(baseline.ActiveDraft);
    }
}
