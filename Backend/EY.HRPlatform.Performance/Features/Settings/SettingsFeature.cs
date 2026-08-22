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

public sealed class UpdateCycleSettingsHandler(PerformanceDbContext db, ITenantContext tenant)
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

        var request = command.Request;
        try
        {
            settings.Update(
                request.DefaultMeasurementMethod,
                request.SuggestedObjectiveCountMin,
                request.SuggestedObjectiveCountMax,
                request.PlanningDeadlineOffsetDays,
                request.AllowStandaloneObjectives);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleSettingsDto>(Error.Validation("Settings.Invalid", ex.Message));
        }

        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToDto(settings);
    }
}
