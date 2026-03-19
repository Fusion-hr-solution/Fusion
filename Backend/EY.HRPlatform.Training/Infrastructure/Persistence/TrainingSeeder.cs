using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Infrastructure.Persistence;

public static class TrainingSeeder
{
    public static async Task SeedAsync(TrainingDbContext db)
    {
        if (await db.Categories.AnyAsync())
            return;

        // --- Categories ---
        var categories = new List<TrainingCategory>
        {
            new("Technical Skills", "Programming languages, frameworks, and development tools"),
            new("Leadership & Management", "Leadership development, team management, and strategic thinking"),
            new("Compliance & Regulatory", "Regulatory requirements, ethics, and compliance training"),
            new("Soft Skills", "Communication, collaboration, and professional development"),
            new("Data & Analytics", "Data analysis, business intelligence, and data-driven decision making"),
        };
        await db.Categories.AddRangeAsync(categories);
        await db.SaveChangesAsync();

        // Reference categories by name for clarity
        var tech = categories[0];
        var leadership = categories[1];
        var compliance = categories[2];
        var softSkills = categories[3];
        var data = categories[4];

        // --- Badges ---
        var badges = new List<Badge>
        {
            new("C# Developer", BadgeLevel.Gold, "Mastered C# and .NET development"),
            new("Cloud Champion", BadgeLevel.Silver, "Proficient in cloud technologies"),
            new("Data Analyst", BadgeLevel.Bronze, "Foundation in data analysis"),
            new("Team Leader", BadgeLevel.Gold, "Proven leadership capabilities"),
            new("Compliance Expert", BadgeLevel.Silver, "Compliance and ethics expert"),
        };
        await db.Badges.AddRangeAsync(badges);
        await db.SaveChangesAsync();

        // --- Trainings ---
        var trainings = new List<TrainingCourse>
        {
            new(
                "C# Fundamentals",
                "Master the core concepts of C# programming including OOP, LINQ, async/await, and modern .NET development patterns.",
                20, false, BadgeLevel.Bronze, tech.Id, "8 hours"),

            new(
                "ASP.NET Core Microservices",
                "Build production-ready microservices with ASP.NET Core, covering DI, middleware, JWT authentication, and API design.",
                40, false, BadgeLevel.Gold, tech.Id, "16 hours"),

            new(
                "Introduction to Cloud Computing",
                "Understand cloud computing fundamentals including IaaS, PaaS, SaaS, and deployment strategies on Azure.",
                15, false, BadgeLevel.Bronze, tech.Id, "6 hours"),

            new(
                "Leadership Essentials",
                "Develop core leadership skills including effective communication, team motivation, conflict resolution, and strategic thinking.",
                25, true, BadgeLevel.Silver, leadership.Id, "10 hours"),

            new(
                "Compliance & Data Privacy",
                "Essential training on GDPR, data handling best practices, and regulatory compliance requirements.",
                10, true, BadgeLevel.Bronze, compliance.Id, "4 hours"),

            new(
                "Effective Communication",
                "Improve your professional communication skills for presentations, written communication, and active listening.",
                15, false, BadgeLevel.Bronze, softSkills.Id, "5 hours"),

            new(
                "Data Analysis with Python",
                "Learn data analysis fundamentals using Python, pandas, and matplotlib for business intelligence insights.",
                30, false, BadgeLevel.Silver, data.Id, "12 hours"),

            new(
                "React for .NET Developers",
                "Bridge the gap between .NET backend and React frontend development with hands-on full-stack projects.",
                35, false, BadgeLevel.Silver, tech.Id, "14 hours"),
        };
        await db.Trainings.AddRangeAsync(trainings);
        await db.SaveChangesAsync();

        // --- Chapters for a few trainings ---
        var csharpTraining = trainings[0];
        var csharpChapters = new List<TrainingChapter>
        {
            new("Introduction to C# and .NET", ContentType.Video, null, 1, csharpTraining.Id),
            new("Variables, Types, and Control Flow", ContentType.Video, null, 2, csharpTraining.Id),
            new("Object-Oriented Programming in C#", ContentType.Video, null, 3, csharpTraining.Id),
            new("LINQ and Collections", ContentType.Article, null, 4, csharpTraining.Id),
            new("Async/Await and Task Parallel Library", ContentType.Video, null, 5, csharpTraining.Id),
        };
        await db.Chapters.AddRangeAsync(csharpChapters);

        var complianceTraining = trainings[4];
        var complianceChapters = new List<TrainingChapter>
        {
            new("Introduction to GDPR", ContentType.Pdf, null, 1, complianceTraining.Id),
            new("Data Classification and Handling", ContentType.Video, null, 2, complianceTraining.Id),
            new("Reporting Data Breaches", ContentType.Article, null, 3, complianceTraining.Id),
            new("Compliance Assessment", ContentType.Pdf, null, 4, complianceTraining.Id),
        };
        await db.Chapters.AddRangeAsync(complianceChapters);
        await db.SaveChangesAsync();

        // --- Exams ---
        var csharpExam = new Exam("C# Fundamentals Assessment", 70, csharpTraining.Id);
        var complianceExam = new Exam("Compliance Knowledge Check", 80, complianceTraining.Id);
        await db.Exams.AddRangeAsync(csharpExam, complianceExam);
        await db.SaveChangesAsync();

        // --- Questions for C# exam ---
        var q1 = new ExamQuestion("Which keyword is used to define an interface in C#?", "SingleChoice", csharpExam.Id);
        await db.ExamQuestions.AddAsync(q1);
        await db.SaveChangesAsync();

        await db.ExamOptions.AddRangeAsync(
            new ExamOption("interface", true, q1.Id),
            new ExamOption("abstract", false, q1.Id),
            new ExamOption("class", false, q1.Id),
            new ExamOption("struct", false, q1.Id));
        await db.SaveChangesAsync();
    }
}
