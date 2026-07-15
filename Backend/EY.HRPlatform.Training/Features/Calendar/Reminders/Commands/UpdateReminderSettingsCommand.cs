using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Reminders.Commands;

/// <summary>Upsert the single global reminder policy.</summary>
public record UpdateReminderSettingsCommand(bool Enabled, List<int> OffsetsMinutes) : ICommand<Result>;

public class UpdateReminderSettingsCommandHandler : ICommandHandler<UpdateReminderSettingsCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateReminderSettingsCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateReminderSettingsCommand request, CancellationToken cancellationToken)
    {
        var offsets = (request.OffsetsMinutes ?? new List<int>()).Where(o => o > 0).Distinct().ToList();
        if (offsets.Count == 0)
            return Result.Failure(Error.Validation("Reminder.NoOffsets", "At least one positive lead-time offset (minutes) is required."));

        var policy = await _db.ReminderPolicies.FirstOrDefaultAsync(cancellationToken);
        if (policy is null)
        {
            policy = new ReminderPolicy(request.Enabled, string.Join(',', offsets.OrderByDescending(o => o)));
            _db.ReminderPolicies.Add(policy);
        }
        else
        {
            policy.Update(request.Enabled, offsets);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
