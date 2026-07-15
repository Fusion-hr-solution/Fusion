using EY.HRPlatform.Training.Features.Calendar.Reminders.Commands;
using EY.HRPlatform.Training.Features.Calendar.Reminders.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class ReminderSettingsHandlerTests
{
    [Fact]
    public async Task Get_ReturnsDefaults_WhenNoPolicy()
    {
        await using var ctx = TestDbContextFactory.Create();

        var result = await new GetReminderSettingsQueryHandler(ctx)
            .Handle(new GetReminderSettingsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.Enabled);
        Assert.Equal(new List<int> { 1440, 60 }, result.Value.OffsetsMinutes);
    }

    [Fact]
    public async Task Update_UpsertsPolicy_AndGetReflectsIt()
    {
        await using var ctx = TestDbContextFactory.Create();

        var update = await new UpdateReminderSettingsCommandHandler(ctx)
            .Handle(new UpdateReminderSettingsCommand(true, new List<int> { 120, 30 }), CancellationToken.None);
        Assert.True(update.IsSuccess);

        Assert.Equal("120,30", (await ctx.ReminderPolicies.SingleAsync()).OffsetsMinutes);

        var get = await new GetReminderSettingsQueryHandler(ctx)
            .Handle(new GetReminderSettingsQuery(), CancellationToken.None);
        Assert.Equal(new List<int> { 120, 30 }, get.Value!.OffsetsMinutes);
    }

    [Fact]
    public async Task Update_RejectsEmptyOffsets()
    {
        await using var ctx = TestDbContextFactory.Create();

        var result = await new UpdateReminderSettingsCommandHandler(ctx)
            .Handle(new UpdateReminderSettingsCommand(true, new List<int>()), CancellationToken.None);

        Assert.True(result.IsFailure);
    }
}
