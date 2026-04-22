using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpdateServiceLineCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesServiceLine_WhenValidData()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateServiceLineCommandHandler(context);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        context.ServiceLines.Add(sl);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpdateServiceLineCommand(sl.Id, "Assurance Updated", "ASR2", "#0000FF", "Desc", true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.ServiceLines.FindAsync(sl.Id);
        Assert.NotNull(updated);
        Assert.Equal("Assurance Updated", updated.Name);
        Assert.Equal("ASR2", updated.Code);
        Assert.Equal("#0000FF", updated.Color);
        Assert.True(updated.IsSharedAcrossAllServiceLines);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateServiceLineCommandHandler(context);

        var result = await handler.Handle(
            new UpdateServiceLineCommand(Guid.NewGuid(), "X", "X", "#000", null, false),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNameTakenByOther()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateServiceLineCommandHandler(context);
        var sl1 = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var sl2 = new ServiceLine("Consulting", "CON", "#8B5CF6", null, false);
        context.ServiceLines.AddRange(sl1, sl2);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpdateServiceLineCommand(sl2.Id, "Assurance", "CON2", "#000", null, false),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }
}
