using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Certifications.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Training.Tests.Handlers.Certifications;

public class CertificateIssuanceServiceTests
{
    private sealed class StubUrlBuilder : ICertificateUrlBuilder
    {
        public string BuildVerificationUrl(string number) => $"http://localhost:3000/learning/verify/{number}";
    }

    private static CertificateIssuanceService BuildService(TrainingDbContext db) => new(
        db,
        new CertificateNumberGenerator(),
        new CertificateQrService(),
        new CertificatePdfService(),
        new StubUrlBuilder(),
        NullLogger<CertificateIssuanceService>.Instance);

    private static async Task<(TrainingCourse course, Guid employeeId)> SeedCompletedAsync(
        TrainingDbContext db, bool issuesCertificate = true, string? profileName = "Youssef Harrabi")
    {
        var category = new TrainingCategory("Tech", "desc");
        db.Categories.Add(category);

        var course = new TrainingCourse("Azure Basics", "Cloud fundamentals", credits: 5,
            isMandatory: false, badgeLevel: BadgeLevel.Bronze, categoryId: category.Id, duration: "2h");
        if (!issuesCertificate) course.SetIssuesCertificate(false);
        db.Trainings.Add(course);

        var employeeId = Guid.NewGuid();
        db.EmployeeProfiles.Add(new EmployeeProfile(employeeId, null, null, profileName, "y@ey.com"));

        var progress = new TrainingProgress(employeeId, course.Id);
        progress.Start();
        progress.Complete();
        db.TrainingProgress.Add(progress);

        await db.SaveChangesAsync();
        return (course, employeeId);
    }

    [Fact]
    public async Task Issue_CreatesSnapshottedCertificateWithPdf_WhenEligible()
    {
        await using var db = TestDbContextFactory.Create();
        var (course, employeeId) = await SeedCompletedAsync(db);

        var cert = await BuildService(db).IssueForCompletionAsync(employeeId, course.Id, "JWT Name", CancellationToken.None);
        await db.SaveChangesAsync();

        Assert.NotNull(cert);
        Assert.StartsWith("EY-CERT-", cert!.CertificateNumber);
        Assert.Equal("Youssef Harrabi", cert.EmployeeFullName); // profile name wins over JWT fallback
        Assert.Equal("Azure Basics", cert.TrainingTitle);
        Assert.Equal(5, cert.Credits);
        Assert.Equal(CertificateStatus.Valid, cert.Status);
        Assert.NotNull(cert.PdfContent);
        Assert.NotEmpty(cert.PdfContent!);
    }

    [Fact]
    public async Task Issue_FallsBackToContextName_WhenProfileNameMissing()
    {
        await using var db = TestDbContextFactory.Create();
        var (course, employeeId) = await SeedCompletedAsync(db, profileName: null);

        var cert = await BuildService(db).IssueForCompletionAsync(employeeId, course.Id, "JWT Fallback", CancellationToken.None);

        Assert.NotNull(cert);
        Assert.Equal("JWT Fallback", cert!.EmployeeFullName);
    }

    [Fact]
    public async Task Issue_IsIdempotent_PerActiveCertificate()
    {
        await using var db = TestDbContextFactory.Create();
        var (course, employeeId) = await SeedCompletedAsync(db);
        var service = BuildService(db);

        var first = await service.IssueForCompletionAsync(employeeId, course.Id, "JWT Name", CancellationToken.None);
        await db.SaveChangesAsync();
        var second = await service.IssueForCompletionAsync(employeeId, course.Id, "JWT Name", CancellationToken.None);
        await db.SaveChangesAsync();

        Assert.Equal(first!.CertificateNumber, second!.CertificateNumber);
        Assert.Equal(1, db.Certifications.Count());
    }

    [Fact]
    public async Task Issue_ReturnsNull_WhenCourseDoesNotIssueCertificates()
    {
        await using var db = TestDbContextFactory.Create();
        var (course, employeeId) = await SeedCompletedAsync(db, issuesCertificate: false);

        var cert = await BuildService(db).IssueForCompletionAsync(employeeId, course.Id, "JWT Name", CancellationToken.None);
        await db.SaveChangesAsync();

        Assert.Null(cert);
        Assert.Equal(0, db.Certifications.Count());
    }
}
