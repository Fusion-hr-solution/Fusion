using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class DeleteServiceLineCommandHandlerTests
{
    [Fact]
    public async Task Handle_DeletesServiceLine_WhenNoProfiles()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteServiceLineCommandHandler(context);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        context.ServiceLines.Add(sl);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new DeleteServiceLineCommand(sl.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await context.ServiceLines.FindAsync(sl.Id));
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteServiceLineCommandHandler(context);

        var result = await handler.Handle(
            new DeleteServiceLineCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenServiceLineHasProfiles()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteServiceLineCommandHandler(context);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        context.ServiceLines.Add(sl);
        await context.SaveChangesAsync();

        var profile = new EmployeeProfile(Guid.NewGuid(), null, sl.Id);
        context.EmployeeProfiles.Add(profile);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new DeleteServiceLineCommand(sl.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("HasProfiles", result.Error.Code);
    }
}
