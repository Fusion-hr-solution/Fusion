using EY.HRPlatform.Performance.Domain.Entities.Platform;
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

public sealed record CreateBaselineDraftCommand(
    ClaimsPrincipal Actor,
    CreateBaselineDraftRequest Request) : ICommand<Result<BaselineVersionDto>>;

public sealed class CreateBaselineDraftCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateBaselineDraftCommand, Result<BaselineVersionDto>>
{
    public async Task<Result<BaselineVersionDto>> Handle(
        CreateBaselineDraftCommand command,
        CancellationToken cancellationToken)
    {
        // Ensure singleton baseline aggregate exists
        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline is null)
        {
            baseline = PlatformObjectiveBaseline.Create();
            db.PlatformObjectiveBaselines.Add(baseline);
        }

        var req = command.Request;
        var draft = baseline.CreateDraft(
            req.MaxObjectivesPerPlan,
            req.AllowedWeightValues,
            req.ManagerValidationSlaDays,
            req.CascadeMode,
            req.MeasurementTypes,
            req.AttachmentsEnabled);

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "BaselineDraftCreated",
            "PlatformObjectiveBaseline",
            baseline.Id,
            versionNumber: draft.VersionNumber,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetBaselineQueryHandler.ToDto(draft);
    }
}
