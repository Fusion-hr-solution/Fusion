using EY.HRPlatform.Training.Features.Calendar.Commands;
using EY.HRPlatform.Training.Features.Calendar.Feed;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class RotateCalendarFeedTokenCommandHandlerTests
{
    private static IConfiguration Config() =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Calendar:FeedBaseUrl"] = "https://academy.example"
        }).Build();

    [Fact]
    public async Task Handle_CreatesTokenRow_StoringHashNotPlaintext_AndBuildsUrls()
    {
        await using var ctx = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var tokens = new CalendarFeedTokenService();
        var handler = new RotateCalendarFeedTokenCommandHandler(ctx, tokens, Config());

        var result = await handler.Handle(new RotateCalendarFeedTokenCommand(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.False(string.IsNullOrWhiteSpace(dto.Token));
        Assert.Equal($"https://academy.example/api/training/calendar/me.ics?token={dto.Token}", dto.FeedUrl);
        Assert.StartsWith("webcal://academy.example/", dto.WebcalUrl);

        var row = await ctx.CalendarFeedTokens.SingleAsync();
        Assert.Equal(employeeId, row.EmployeeId);
        Assert.NotEqual(dto.Token, row.TokenHash);            // plaintext is never stored
        Assert.Equal(tokens.Hash(dto.Token), row.TokenHash);  // the stored value is the hash
        Assert.Null(row.RevokedAt);
    }

    [Fact]
    public async Task Handle_Rotate_OverwritesHash_OldTokenDead_OneRowPerEmployee()
    {
        await using var ctx = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var tokens = new CalendarFeedTokenService();
        var handler = new RotateCalendarFeedTokenCommandHandler(ctx, tokens, Config());

        var first = (await handler.Handle(new RotateCalendarFeedTokenCommand(employeeId), CancellationToken.None)).Value!;
        var firstHash = tokens.Hash(first.Token);

        var second = (await handler.Handle(new RotateCalendarFeedTokenCommand(employeeId), CancellationToken.None)).Value!;

        Assert.NotEqual(first.Token, second.Token);
        var row = await ctx.CalendarFeedTokens.SingleAsync();        // still exactly one row
        Assert.Equal(tokens.Hash(second.Token), row.TokenHash);
        Assert.NotEqual(firstHash, row.TokenHash);                  // old hash overwritten → old URL dead
    }
}
