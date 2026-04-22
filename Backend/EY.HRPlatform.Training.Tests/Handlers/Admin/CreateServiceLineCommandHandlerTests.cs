using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class CreateServiceLineCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesServiceLine_WhenValidData()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateServiceLineCommandHandler(context);

        var result = await handler.Handle(
            new CreateServiceLineCommand("Assurance", "ASR", "#3B82F6", "Audit services", false),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var sl = await context.ServiceLines.FindAsync(result.Value);
        Assert.NotNull(sl);
        Assert.Equal("Assurance", sl.Name);
        Assert.Equal("ASR", sl.Code);
        Assert.Equal("#3B82F6", sl.Color);
        Assert.False(sl.IsSharedAcrossAllServiceLines);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateName()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateServiceLineCommandHandler(context);
        context.ServiceLines.Add(new ServiceLine("Assurance", "ASR", "#3B82F6", null, false));
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new CreateServiceLineCommand("Assurance", "ASR2", "#000", null, false),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateCode()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateServiceLineCommandHandler(context);
        context.ServiceLines.Add(new ServiceLine("Assurance", "ASR", "#3B82F6", null, false));
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new CreateServiceLineCommand("Audit", "ASR", "#000", null, false),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("CodeDuplicate", result.Error.Code);
    }

    [Fact]
    public async Task Handle_CreatesSharedServiceLine()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateServiceLineCommandHandler(context);

        var result = await handler.Handle(
            new CreateServiceLineCommand("Shared SL", "SHR", "#FFF", null, true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var sl = await context.ServiceLines.FindAsync(result.Value);
        Assert.NotNull(sl);
        Assert.True(sl.IsSharedAcrossAllServiceLines);
    }
}
