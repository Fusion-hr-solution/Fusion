using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.TestHelpers;

public static class TestDbContextFactory
{
    public static TrainingDbContext Create(string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options;

        var context = new TrainingDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    public static async Task<TrainingDbContext> CreateWithSeedDataAsync(string? databaseName = null)
    {
        var context = Create(databaseName);
        await SeedTestDataAsync(context);
        return context;
    }

    private static async Task SeedTestDataAsync(TrainingDbContext context)
    {
        var category = new Domain.Entities.TrainingCategory("Technical Skills", "Technical training courses");
        context.Categories.Add(category);

        var course1 = new Domain.Entities.TrainingCourse(
            "Introduction to .NET",
            "Learn the basics of .NET development",
            credits: 10,
            isMandatory: false,
            badgeLevel: Domain.Enums.BadgeLevel.Bronze,
            categoryId: category.Id,
            duration: "2 hours");
        
        var course2 = new Domain.Entities.TrainingCourse(
            "Advanced C#",
            "Master advanced C# concepts",
            credits: 25,
            isMandatory: true,
            badgeLevel: Domain.Enums.BadgeLevel.Gold,
            categoryId: category.Id,
            duration: "5 hours");

        context.Trainings.Add(course1);
        context.Trainings.Add(course2);

        // Add chapters
        var chapter1 = new Domain.Entities.TrainingChapter(
            "Getting Started",
            Domain.Enums.ChapterLayout.SingleContent,
            1,
            course1.Id);
        chapter1.AddContentBlock(new Domain.Entities.ContentBlock(
            Domain.Enums.ContentType.Video, 0, chapter1.Id,
            "Intro Video", null, "https://example.com/video1", null, null));
        
        var chapter2 = new Domain.Entities.TrainingChapter(
            "First Application",
            Domain.Enums.ChapterLayout.SingleContent,
            2,
            course1.Id);
        chapter2.AddContentBlock(new Domain.Entities.ContentBlock(
            Domain.Enums.ContentType.Article, 0, chapter2.Id,
            "Lab Article", "Some content", "https://example.com/lab1", null, null));

        context.Chapters.Add(chapter1);
        context.Chapters.Add(chapter2);

        await context.SaveChangesAsync();
    }
}
