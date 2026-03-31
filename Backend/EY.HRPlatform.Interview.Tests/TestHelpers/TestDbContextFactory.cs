using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Tests.TestHelpers;

public static class TestDbContextFactory
{
    public static AppDbContext Create(string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName ?? Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }
}