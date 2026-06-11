using System.Text;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Certifications.Services;

namespace EY.HRPlatform.Training.Tests.Handlers.Certifications;

public class CertificateGenerationTests
{
    private static Certification SampleCertificate() => new(
        "EY-CERT-2026-7F3KQ9AB",
        new CertificateSnapshot(
            EmployeeId: Guid.NewGuid(),
            EmployeeFullName: "Youssef Harrabi",
            GradeId: Guid.NewGuid(),
            GradeName: "Senior",
            ServiceLineId: Guid.NewGuid(),
            ServiceLineName: "Consulting",
            TrainingId: Guid.NewGuid(),
            TrainingTitle: "Advanced Azure Architecture",
            TrainingDescription: "Designing resilient cloud systems on Azure.",
            Credits: 5,
            Duration: "8h",
            TrainerName: null,
            CompletedAt: new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc)));

    [Fact]
    public void NumberGenerator_ProducesUnguessablePrefixedNumber()
    {
        var generator = new CertificateNumberGenerator();

        var number = generator.Generate(2026);

        Assert.StartsWith("EY-CERT-2026-", number);
        Assert.Equal("EY-CERT-2026-".Length + 8, number.Length);
        // Crockford base32 suffix excludes I, L, O, U.
        Assert.DoesNotContain(number["EY-CERT-2026-".Length..], c => c is 'I' or 'L' or 'O' or 'U');
    }

    [Fact]
    public void NumberGenerator_ProducesDistinctNumbers()
    {
        var generator = new CertificateNumberGenerator();
        var numbers = Enumerable.Range(0, 200).Select(_ => generator.Generate(2026)).ToHashSet();
        Assert.Equal(200, numbers.Count);
    }

    [Fact]
    public void QrService_ProducesNonEmptyPng()
    {
        var qr = new CertificateQrService();

        var png = qr.GeneratePng("http://localhost:3000/learning/verify/EY-CERT-2026-7F3KQ9AB");

        Assert.NotEmpty(png);
        // PNG signature: 0x89 'P' 'N' 'G'
        Assert.Equal(0x89, png[0]);
        Assert.Equal((byte)'P', png[1]);
    }

    [Fact]
    public void PdfService_RendersValidPdf_WithoutThrowing()
    {
        var qr = new CertificateQrService();
        var pdfService = new CertificatePdfService();
        var cert = SampleCertificate();
        var url = $"http://localhost:3000/learning/verify/{cert.CertificateNumber}";

        var pdf = pdfService.Generate(cert, qr.GeneratePng(url), url);

        Assert.NotEmpty(pdf);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
