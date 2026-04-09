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
        var ch1 = new TrainingChapter("Introduction to C# and .NET", ChapterLayout.SingleContent, 1, csharpTraining.Id);
        ch1.AddContentBlock(new ContentBlock(ContentType.Video, 0, ch1.Id,
            "Introduction Video", null, null,
            "https://www.youtube.com/embed/GhQdlMFylQ8", 45));

        var ch2 = new TrainingChapter("Variables, Types, and Control Flow", ChapterLayout.SingleContent, 2, csharpTraining.Id);
        ch2.AddContentBlock(new ContentBlock(ContentType.Video, 0, ch2.Id,
            "Variables Video", null, null,
            "https://www.youtube.com/embed/IFayQioG71A", 60));

        var ch3 = new TrainingChapter("Object-Oriented Programming in C#", ChapterLayout.SingleContent, 3, csharpTraining.Id);
        ch3.AddContentBlock(new ContentBlock(ContentType.Article, 0, ch3.Id,
            "OOP Article", """
                # Object-Oriented Programming in C#

                ## Introduction
                Object-Oriented Programming (OOP) is a paradigm that organizes code around **objects** — instances of classes that bundle data and behavior.

                ## The Four Pillars of OOP

                ### 1. Encapsulation
                Encapsulation hides internal state and requires all interaction through well-defined methods.

                ```csharp
                public class BankAccount
                {
                    private decimal _balance;

                    public decimal Balance => _balance;

                    public void Deposit(decimal amount)
                    {
                        if (amount <= 0) throw new ArgumentException("Amount must be positive");
                        _balance += amount;
                    }
                }
                ```

                ### 2. Inheritance
                Inheritance allows a class to inherit members from a base class, promoting code reuse.

                ```csharp
                public class Employee : Person
                {
                    public string Department { get; set; }
                }
                ```

                ### 3. Polymorphism
                Polymorphism enables objects of different types to be treated through a common interface.

                ```csharp
                public abstract class Shape
                {
                    public abstract double Area();
                }

                public class Circle : Shape
                {
                    public double Radius { get; set; }
                    public override double Area() => Math.PI * Radius * Radius;
                }
                ```

                ### 4. Abstraction
                Abstraction focuses on exposing only relevant details while hiding implementation complexity.

                ## Summary
                Understanding these four pillars is essential for writing clean, maintainable C# code. Practice by refactoring procedural code into well-structured OOP designs.
                """,
            null, null, 90));

        var ch4 = new TrainingChapter("LINQ and Collections", ChapterLayout.SingleContent, 4, csharpTraining.Id);
        ch4.AddContentBlock(new ContentBlock(ContentType.Article, 0, ch4.Id,
            "LINQ Article", """
                # LINQ and Collections in C#

                ## What is LINQ?
                Language Integrated Query (LINQ) provides a consistent query syntax for working with data from different sources.

                ## Query Syntax vs Method Syntax

                ```csharp
                // Query syntax
                var result = from student in students
                             where student.Grade > 80
                             orderby student.Name
                             select student;

                // Method syntax (fluent)
                var result = students
                    .Where(s => s.Grade > 80)
                    .OrderBy(s => s.Name);
                ```

                ## Common LINQ Methods
                - **Where** — Filters elements based on a predicate
                - **Select** — Projects each element into a new form
                - **OrderBy / OrderByDescending** — Sorts elements
                - **GroupBy** — Groups elements by a key
                - **First / FirstOrDefault** — Returns the first element
                - **Any / All** — Tests conditions across the collection

                ## Collections Overview
                | Type | Description |
                |------|-------------|
                | `List<T>` | Dynamic array |
                | `Dictionary<TKey, TValue>` | Key-value pairs |
                | `HashSet<T>` | Unique elements |
                | `Queue<T>` | FIFO collection |
                | `Stack<T>` | LIFO collection |

                ## Performance Tips
                - Use `AsNoTracking()` for read-only EF Core queries
                - Prefer `ToListAsync()` over `ToList()` in async contexts
                - Avoid multiple enumeration with `ToList()` when needed
                """,
            null, null, 75));

        var ch5 = new TrainingChapter("Async/Await and Task Parallel Library", ChapterLayout.SingleContent, 5, csharpTraining.Id);
        ch5.AddContentBlock(new ContentBlock(ContentType.Exercise, 0, ch5.Id,
            "Async Exercise", """
                # Exercise: Async/Await and Task Parallel Library

                ## Objective
                Practice using async/await patterns and the Task Parallel Library in C#.

                ## Exercise 1: Async File Processing
                Create an async method that reads multiple files concurrently and returns their combined content.

                ```csharp
                public async Task<string> ReadFilesAsync(string[] filePaths)
                {
                    // TODO: Implement using Task.WhenAll
                    // Each file should be read with File.ReadAllTextAsync
                    // Return all contents joined with newlines
                }
                ```

                ## Exercise 2: Rate-Limited API Calls
                Implement a method that calls an API endpoint for each item in a list, but limits concurrency to 3 simultaneous requests.

                ```csharp
                public async Task<List<ApiResult>> FetchAllAsync(
                    List<string> urls,
                    HttpClient client)
                {
                    // TODO: Use SemaphoreSlim to limit concurrency
                }
                ```

                ## Exercise 3: Cancellation Support
                Add CancellationToken support to a long-running task.

                ```csharp
                public async Task ProcessDataAsync(
                    IEnumerable<DataItem> items,
                    CancellationToken cancellationToken = default)
                {
                    // TODO: Check cancellation between items
                    // Throw OperationCanceledException if cancelled
                }
                ```

                ## Acceptance Criteria
                - All exercises compile without errors
                - Proper exception handling for async operations
                - Cancellation is checked at appropriate intervals
                """,
            null, null, 120));

        var csharpChapters = new List<TrainingChapter> { ch1, ch2, ch3, ch4, ch5 };
        await db.Chapters.AddRangeAsync(csharpChapters);

        var complianceTraining = trainings[4];
        var cch1 = new TrainingChapter("Introduction to GDPR", ChapterLayout.SingleContent, 1, complianceTraining.Id);
        cch1.AddContentBlock(new ContentBlock(ContentType.Pdf, 0, cch1.Id,
            "GDPR Overview", """
                # Introduction to GDPR

                ## What is GDPR?
                The General Data Protection Regulation (GDPR) is a comprehensive data protection regulation adopted by the European Union in 2016 and enforced from May 25, 2018.

                ## Key Principles
                1. **Lawfulness, fairness, and transparency** — Data must be processed lawfully
                2. **Purpose limitation** — Collected for specified, explicit purposes
                3. **Data minimization** — Adequate, relevant, and limited
                4. **Accuracy** — Kept up to date
                5. **Storage limitation** — Kept only as long as necessary
                6. **Integrity and confidentiality** — Appropriate security measures

                ## Data Subject Rights
                - Right to access
                - Right to rectification
                - Right to erasure ("right to be forgotten")
                - Right to data portability
                - Right to object

                ## Penalties
                Non-compliance can result in fines of up to €20 million or 4% of global annual turnover, whichever is higher.
                """,
            "https://gdpr-info.eu/art-1-gdpr/", null, 30));

        var cch2 = new TrainingChapter("Data Classification and Handling", ChapterLayout.SingleContent, 2, complianceTraining.Id);
        cch2.AddContentBlock(new ContentBlock(ContentType.Video, 0, cch2.Id,
            "Data Classification Video", null, null,
            "https://www.youtube.com/embed/example-data-classification", 45));

        var cch3 = new TrainingChapter("Reporting Data Breaches", ChapterLayout.SingleContent, 3, complianceTraining.Id);
        cch3.AddContentBlock(new ContentBlock(ContentType.Article, 0, cch3.Id,
            "Data Breaches Article", """
                # Reporting Data Breaches

                ## What Constitutes a Data Breach?
                A data breach is any security incident that leads to unauthorized access, disclosure, alteration, or destruction of personal data.

                ## Reporting Timeline
                Under GDPR, data breaches must be reported to the relevant supervisory authority **within 72 hours** of becoming aware of the breach.

                ## Steps to Follow
                1. **Identify** — Determine the scope and nature of the breach
                2. **Contain** — Take immediate steps to limit the breach
                3. **Assess** — Evaluate the risk to individuals
                4. **Notify** — Report to authorities and affected individuals if high risk
                5. **Document** — Record all details for compliance audit

                ## Notification Requirements
                The notification must include:
                - Nature of the breach
                - Categories and approximate number of individuals affected
                - Contact details of the Data Protection Officer
                - Likely consequences
                - Measures taken or proposed to address the breach
                """,
            null, null, 35));

        var cch4 = new TrainingChapter("Compliance Assessment", ChapterLayout.SingleContent, 4, complianceTraining.Id);
        cch4.AddContentBlock(new ContentBlock(ContentType.Exercise, 0, cch4.Id,
            "Compliance Exercise", """
                # Compliance Assessment Exercise

                ## Scenario
                You are the Data Protection Officer at a mid-size financial services firm. Review the following scenarios and determine the appropriate action.

                ## Scenario 1: Marketing Emails
                The marketing department wants to send promotional emails to all customers in the database, including those who haven't provided explicit consent.

                **Question:** What should you advise? What GDPR article applies?

                ## Scenario 2: Third-Party Data Sharing
                A partner company requests access to customer transaction data for analytics purposes.

                **Question:** What safeguards must be in place? What documentation is required?

                ## Scenario 3: Data Breach Response
                An employee's laptop containing unencrypted customer data is stolen from a coffee shop.

                **Question:** Walk through the complete breach response process. Who must be notified and within what timeframe?

                ## Deliverable
                Write a brief report (500 words) for each scenario outlining your recommendations with references to specific GDPR articles.
                """,
            null, null, 60));

        var complianceChapters = new List<TrainingChapter> { cch1, cch2, cch3, cch4 };
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
