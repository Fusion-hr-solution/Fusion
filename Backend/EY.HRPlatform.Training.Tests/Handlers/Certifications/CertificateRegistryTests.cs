using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Certifications.Commands;
using EY.HRPlatform.Training.Features.Certifications.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Training.Tests.Handlers.Certifications;

public class CertificateRegistryTests
{
    private static readonly Guid T1 = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid T2 = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid G1 = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private static Certification Cert(
        string number, string fullName, Guid trainingId, string trainingTitle,
        Guid? gradeId = null, string? gradeName = null, bool revoked = false, Guid? employeeId = null)
    {
        var c = new Certification(number, new CertificateSnapshot(
            employeeId ?? Guid.NewGuid(), fullName, gradeId, gradeName, null, null,
            trainingId, trainingTitle, "desc", 5, "2h", null,
            new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc)));
        if (revoked) c.Revoke("seeded", "seed@ey.com");
        return c;
    }

    private static ReinstateCertificateCommandHandler ReinstateHandler(TrainingDbContext db) =>
        new(db, NullLogger<ReinstateCertificateCommandHandler>.Instance);

    private static async Task<TrainingDbContext> SeedAsync()
    {
        var db = TestDbContextFactory.Create();
        db.Certifications.AddRange(
            Cert("EY-CERT-2026-AAAA1111", "Youssef Harrabi", T1, "Azure", G1, "Senior"),
            Cert("EY-CERT-2026-BBBB2222", "Sarah Müller", T1, "Azure", G1, "Senior"),
            Cert("EY-CERT-2026-CCCC3333", "John Smith", T2, "React", null, null, revoked: true));
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Registry_FiltersByTraining()
    {
        await using var db = await SeedAsync();

        var result = await new GetCertificateRegistryQueryHandler(db).Handle(
            new GetCertificateRegistryQuery(T1, null, null, null, null, null, 1, 10), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.TotalCount);
        Assert.All(result.Value.Items, r => Assert.Equal("Azure", r.TrainingTitle));
    }

    [Fact]
    public async Task Registry_FiltersByStatus_AndGrade()
    {
        await using var db = await SeedAsync();

        var revoked = await new GetCertificateRegistryQueryHandler(db).Handle(
            new GetCertificateRegistryQuery(null, null, null, null, "Revoked", null, 1, 10), CancellationToken.None);
        Assert.Equal(1, revoked.Value!.TotalCount);
        Assert.Equal("Revoked", revoked.Value.Items[0].Status);

        var byGrade = await new GetCertificateRegistryQueryHandler(db).Handle(
            new GetCertificateRegistryQuery(null, G1, null, null, null, null, 1, 10), CancellationToken.None);
        Assert.Equal(2, byGrade.Value!.TotalCount);
    }

    [Fact]
    public async Task Registry_SearchesByNumberOrName()
    {
        await using var db = await SeedAsync();

        var byName = await new GetCertificateRegistryQueryHandler(db).Handle(
            new GetCertificateRegistryQuery(null, null, null, null, null, "Youssef", 1, 10), CancellationToken.None);
        Assert.Equal(1, byName.Value!.TotalCount);

        var byNumber = await new GetCertificateRegistryQueryHandler(db).Handle(
            new GetCertificateRegistryQuery(null, null, null, null, null, "CCCC3333", 1, 10), CancellationToken.None);
        Assert.Equal(1, byNumber.Value!.TotalCount);
    }

    [Fact]
    public async Task Stats_CountsTotalsAndByTraining()
    {
        await using var db = await SeedAsync();

        var result = await new GetCertificateStatsQueryHandler(db).Handle(
            new GetCertificateStatsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.Total);
        Assert.Equal(2, result.Value.ValidCount);
        Assert.Equal(1, result.Value.RevokedCount);
        Assert.Equal("Azure", result.Value.ByTraining[0].Key); // most issued first
        Assert.Equal(2, result.Value.ByTraining[0].Count);
        // Certificates are issued "now" (IssuedAt = DateTime.UtcNow), so the single ByMonth bucket
        // tracks the current UTC month. Derive the expected key from the same clock rather than
        // hard-coding it — a literal month passes only during that month and rots at the next rollover.
        Assert.Single(result.Value.ByMonth);
        Assert.Equal($"{DateTime.UtcNow:yyyy-MM}", result.Value.ByMonth[0].Key);
        Assert.Equal(3, result.Value.ByMonth[0].Count);
    }

    [Fact]
    public async Task Revoke_RevokesValidCertificate()
    {
        await using var db = await SeedAsync();
        var valid = db.Certifications.First(c => c.Status == CertificateStatus.Valid);

        var result = await new RevokeCertificateCommandHandler(db).Handle(
            new RevokeCertificateCommand(valid.Id, "Issued in error", "admin@ey.com"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var reloaded = db.Certifications.First(c => c.Id == valid.Id);
        Assert.Equal(CertificateStatus.Revoked, reloaded.Status);
        Assert.Equal("Issued in error", reloaded.RevokedReason);
        Assert.Equal("admin@ey.com", reloaded.RevokedBy);
    }

    [Fact]
    public async Task Revoke_Fails_WhenAlreadyRevoked()
    {
        await using var db = await SeedAsync();
        var revoked = db.Certifications.First(c => c.Status == CertificateStatus.Revoked);

        var result = await new RevokeCertificateCommandHandler(db).Handle(
            new RevokeCertificateCommand(revoked.Id, "again", "admin@ey.com"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("AlreadyRevoked", result.Error.Code);
    }

    [Fact]
    public async Task Revoke_Fails_WhenNotFound()
    {
        await using var db = await SeedAsync();

        var result = await new RevokeCertificateCommandHandler(db).Handle(
            new RevokeCertificateCommand(Guid.NewGuid(), "reason", "admin@ey.com"), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task Reinstate_RestoresRevokedCertificate_AndClearsFields()
    {
        await using var db = await SeedAsync();
        var revoked = db.Certifications.First(c => c.Status == CertificateStatus.Revoked);

        var result = await ReinstateHandler(db).Handle(
            new ReinstateCertificateCommand(revoked.Id, "admin@ey.com"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var reloaded = db.Certifications.First(c => c.Id == revoked.Id);
        Assert.Equal(CertificateStatus.Valid, reloaded.Status);
        Assert.Null(reloaded.RevokedReason);
        Assert.Null(reloaded.RevokedAt);
        Assert.Equal("admin@ey.com", reloaded.UpdatedBy);
    }

    [Fact]
    public async Task Reinstate_Fails_WhenNotRevoked()
    {
        await using var db = await SeedAsync();
        var valid = db.Certifications.First(c => c.Status == CertificateStatus.Valid);

        var result = await ReinstateHandler(db).Handle(
            new ReinstateCertificateCommand(valid.Id, "admin@ey.com"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotRevoked", result.Error.Code);
    }

    [Fact]
    public async Task Reinstate_Fails_WhenActiveCertificateAlreadyExists()
    {
        await using var db = TestDbContextFactory.Create();
        var employee = Guid.NewGuid();
        var revoked = Cert("EY-CERT-2026-OLD00001", "Youssef Harrabi", T1, "Azure", revoked: true, employeeId: employee);
        var active = Cert("EY-CERT-2026-NEW00001", "Youssef Harrabi", T1, "Azure", employeeId: employee);
        db.Certifications.AddRange(revoked, active);
        await db.SaveChangesAsync();

        var result = await ReinstateHandler(db).Handle(
            new ReinstateCertificateCommand(revoked.Id, "admin@ey.com"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("ActiveExists", result.Error.Code);
    }
}
