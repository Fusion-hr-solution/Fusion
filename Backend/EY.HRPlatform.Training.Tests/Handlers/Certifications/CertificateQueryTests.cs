using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Certifications;
using EY.HRPlatform.Training.Features.Certifications.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Certifications;

public class CertificateQueryTests
{
    private static Certification Cert(Guid employeeId, string number, string fullName, string title) => new(
        number,
        new CertificateSnapshot(
            EmployeeId: employeeId,
            EmployeeFullName: fullName,
            GradeId: null, GradeName: "Senior",
            ServiceLineId: null, ServiceLineName: "Consulting",
            TrainingId: Guid.NewGuid(),
            TrainingTitle: title,
            TrainingDescription: "desc",
            Credits: 5, Duration: "2h", TrainerName: null,
            CompletedAt: new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc)));

    [Theory]
    [InlineData("Youssef Harrabi", "You**** Har****")]
    [InlineData("Al Bo", "Al Bo")]                 // both parts <= 3 → shown as-is
    [InlineData("Jo", "Jo")]
    [InlineData("Alexander", "Ale******")]
    public void Mask_AppliesFirstThreeRule(string input, string expected)
    {
        Assert.Equal(expected, CertificateNameMasking.Mask(input));
    }

    [Fact]
    public async Task Verify_ReturnsMaskedDto_ForExistingCertificate()
    {
        await using var db = TestDbContextFactory.Create();
        db.Certifications.Add(Cert(Guid.NewGuid(), "EY-CERT-2026-7F3KQ9AB", "Youssef Harrabi", "Azure Basics"));
        await db.SaveChangesAsync();

        var result = await new VerifyCertificateQueryHandler(db)
            .Handle(new VerifyCertificateQuery("EY-CERT-2026-7F3KQ9AB"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("You**** Har****", result.Value!.MaskedEmployeeName);
        Assert.Equal("Azure Basics", result.Value.TrainingTitle);
        Assert.Equal("Valid", result.Value.Status);
    }

    [Fact]
    public async Task Verify_ReflectsRevokedStatus()
    {
        await using var db = TestDbContextFactory.Create();
        var cert = Cert(Guid.NewGuid(), "EY-CERT-2026-REVOKED1", "Youssef Harrabi", "Azure Basics");
        cert.Revoke("Issued in error", "admin@ey.com");
        db.Certifications.Add(cert);
        await db.SaveChangesAsync();

        var result = await new VerifyCertificateQueryHandler(db)
            .Handle(new VerifyCertificateQuery("EY-CERT-2026-REVOKED1"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Revoked", result.Value!.Status);
    }

    [Fact]
    public async Task Verify_Fails_ForUnknownNumber()
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new VerifyCertificateQueryHandler(db)
            .Handle(new VerifyCertificateQuery("EY-CERT-2026-NOPE0000"), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task GetMine_ReturnsOnlyRequestingEmployeesCertificates()
    {
        await using var db = TestDbContextFactory.Create();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        db.Certifications.Add(Cert(me, "EY-CERT-2026-MINE0001", "Youssef Harrabi", "Azure"));
        db.Certifications.Add(Cert(me, "EY-CERT-2026-MINE0002", "Youssef Harrabi", "AWS"));
        db.Certifications.Add(Cert(other, "EY-CERT-2026-OTHER001", "Someone Else", "GCP"));
        await db.SaveChangesAsync();

        var result = await new GetMyCertificatesQueryHandler(db)
            .Handle(new GetMyCertificatesQuery(me), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Count);
        Assert.All(result.Value, c => Assert.StartsWith("EY-CERT-2026-MINE", c.CertificateNumber));
    }
}
