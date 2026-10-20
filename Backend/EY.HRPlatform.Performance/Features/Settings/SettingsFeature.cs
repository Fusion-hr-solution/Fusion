using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Settings;

public sealed record GetCycleSettingsQuery : IQuery<Result<CycleSettingsDto>>;

public sealed record UpdateCycleSettingsCommand(UpdateCycleSettingsRequest Request) : ICommand<Result<CycleSettingsDto>>;

public sealed class GetCycleSettingsHandler(PerformanceDbContext db, ITenantContext tenant)
    : IQueryHandler<GetCycleSettingsQuery, Result<CycleSettingsDto>>
{
    public async Task<Result<CycleSettingsDto>> Handle(GetCycleSettingsQuery request, CancellationToken cancellationToken)
    {
        var settings = await db.CycleSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = CycleSettings.CreateDefault(tenant.TenantId);
            db.CycleSettings.Add(settings);
            await db.SaveChangesAsync(cancellationToken);
        }

        return PerformanceMappers.ToDto(settings, await CurrentScale.ValuesAsync(db, cancellationToken));
    }
}

internal static class CurrentScale
{
    /// <summary>The values of the tenant's current rating scale, or the default scale before one was saved.</summary>
    public static async Task<IReadOnlyList<int>> ValuesAsync(PerformanceDbContext db, CancellationToken token)
    {
        var scale = await db.RatingScales.AsNoTracking().SingleOrDefaultAsync(token);
        if (scale?.CurrentVersionId is Guid versionId
            && await db.RatingScaleVersions.AsNoTracking().FirstOrDefaultAsync(version => version.Id == versionId, token) is { } current)
            return current.Levels.Select(level => level.Value).ToArray();
        return RatingScaleDefaults.Levels.Select(level => level.Value).ToArray();
    }
}

public sealed class UpdateCycleSettingsHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<UpdateCycleSettingsCommand, Result<CycleSettingsDto>>
{
    public async Task<Result<CycleSettingsDto>> Handle(UpdateCycleSettingsCommand command, CancellationToken cancellationToken)
    {
        var settings = await db.CycleSettings.FirstOrDefaultAsync(cancellationToken)
            ?? CycleSettings.CreateDefault(tenant.TenantId);

        if (db.Entry(settings).State == EntityState.Detached)
        {
            db.CycleSettings.Add(settings);
        }

        if (VersionGuard.Check(settings, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<CycleSettingsDto>(stale);

        var before = new
        {
            settings.DefaultMeasurementMethod,
            settings.SuggestedObjectiveCountMin,
            settings.SuggestedObjectiveCountMax,
            settings.PlanningDeadlineOffsetDays,
            settings.PlanAlignmentPolicy,
            settings.DefaultSelfAssessmentEnabled,
            settings.DefaultObjectiveRatingsEnabled,
            settings.DefaultCalibrationEnabled,
            settings.EvidenceRetentionMonths,
            settings.AiAssistanceEnabled,
            settings.DefaultOneOnOneCadence,
            settings.SelfAssessmentDueDays,
            settings.PeerInputDueDays,
            settings.ManagerAssessmentDueDays,
            settings.AcknowledgementReminderDays,
            settings.NineBoxLowTop,
            settings.NineBoxMidTop,
        };
        var request = command.Request;
        var scale = await CurrentScale.ValuesAsync(db, cancellationToken);
        try
        {
            settings.Update(
                request.DefaultMeasurementMethod,
                request.SuggestedObjectiveCountMin,
                request.SuggestedObjectiveCountMax,
                request.PlanningDeadlineOffsetDays,
                request.PlanAlignmentPolicy,
                request.EvidenceRetentionMonths,
                request.DefaultSelfAssessmentEnabled,
                request.DefaultObjectiveRatingsEnabled,
                request.DefaultCalibrationEnabled,
                request.AiAssistanceEnabled,
                request.DefaultOneOnOneCadence);
            settings.UpdateReviewDueDays(
                request.SelfAssessmentDueDays ?? settings.SelfAssessmentDueDays,
                request.PeerInputDueDays ?? settings.PeerInputDueDays,
                request.ManagerAssessmentDueDays ?? settings.ManagerAssessmentDueDays,
                request.AcknowledgementReminderDays ?? settings.AcknowledgementReminderDays);
            // Sending back the bands already in force is no change, so a default never turns custom by a round trip.
            var inForce = Calibration.CalibrationSessions.BandsFor(settings, scale);
            if (request.NineBoxBands is { } bands && (bands.LowTop != inForce.LowTop || bands.MidTop != inForce.MidTop || bands.LowTop is null))
                settings.UpdateNineBoxBands(bands.LowTop, bands.MidTop, scale);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleSettingsDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.SettingsInvalid, ex.Message));
        }

        var after = new
        {
            settings.DefaultMeasurementMethod,
            settings.SuggestedObjectiveCountMin,
            settings.SuggestedObjectiveCountMax,
            settings.PlanningDeadlineOffsetDays,
            settings.PlanAlignmentPolicy,
            settings.DefaultSelfAssessmentEnabled,
            settings.DefaultObjectiveRatingsEnabled,
            settings.DefaultCalibrationEnabled,
            settings.EvidenceRetentionMonths,
            settings.AiAssistanceEnabled,
            settings.DefaultOneOnOneCadence,
            settings.SelfAssessmentDueDays,
            settings.PeerInputDueDays,
            settings.ManagerAssessmentDueDays,
            settings.AcknowledgementReminderDays,
            settings.NineBoxLowTop,
            settings.NineBoxMidTop,
        };
        if (!Equals(before, after))
            audit.Record(settings.TenantId, "CycleSettings", settings.Id, null, PerformanceAuditActions.SettingsChanged, new { before, after });
        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToDto(settings, scale);
    }
}
