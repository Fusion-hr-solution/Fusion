using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Reminders.Queries;

/// <summary>The current global reminder policy (defaults to enabled, [1440, 60] when none is set).</summary>
public record GetReminderSettingsQuery : IQuery<Result<ReminderSettingsDto>>;

public class GetReminderSettingsQueryHandler : IQueryHandler<GetReminderSettingsQuery, Result<ReminderSettingsDto>>
{
    private readonly TrainingDbContext _db;

    public GetReminderSettingsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<ReminderSettingsDto>> Handle(GetReminderSettingsQuery request, CancellationToken cancellationToken)
    {
        var policy = await _db.ReminderPolicies.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        return Result.Success(new ReminderSettingsDto
        {
            Enabled = policy?.Enabled ?? true,
            OffsetsMinutes = (policy?.Offsets() ?? new List<int> { 1440, 60 }).ToList(),
        });
    }
}
