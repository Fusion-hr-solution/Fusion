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

        return PerformanceMappers.ToDto(settings);
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
        };
        var request = command.Request;
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
                request.DefaultCalibrationEnabled);
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
        };
        if (!Equals(before, after))
            audit.Record(settings.TenantId, "CycleSettings", settings.Id, null, PerformanceAuditActions.SettingsChanged, new { before, after });
        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToDto(settings);
    }
}
