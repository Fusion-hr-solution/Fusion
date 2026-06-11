using System.Text;
using EY.HRPlatform.Training.Features.Certifications.Export;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Tests.Handlers.Certifications;

public class CertificateRegistryExporterTests
{
    private static IReadOnlyList<CertificateRegistryDto> Sample() => new List<CertificateRegistryDto>
    {
        new() { CertificateNumber = "EY-CERT-2026-AAAA1111", EmployeeFullName = "Youssef Harrabi", GradeName = "Senior", ServiceLineName = "Consulting", TrainingTitle = "Azure", Credits = 5, CompletedAt = DateTime.UtcNow, IssuedAt = DateTime.UtcNow, Status = "Valid" },
        new() { CertificateNumber = "EY-CERT-2026-BBBB2222", EmployeeFullName = "Sarah Müller", TrainingTitle = "React", Credits = 3, CompletedAt = DateTime.UtcNow, IssuedAt = DateTime.UtcNow, Status = "Revoked" },
    };

    [Fact]
    public void ToExcel_ProducesNonEmptyXlsx()
    {
        var bytes = new CertificateRegistryExporter().ToExcel(Sample());
        Assert.NotEmpty(bytes);
        Assert.Equal((byte)'P', bytes[0]); // XLSX is a zip → "PK"
        Assert.Equal((byte)'K', bytes[1]);
    }

    [Fact]
    public void ToPdf_ProducesValidPdf()
    {
        var bytes = new CertificateRegistryExporter().ToPdf(Sample());
        Assert.NotEmpty(bytes);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public void Exporters_HandleEmptyList()
    {
        var exporter = new CertificateRegistryExporter();
        Assert.NotEmpty(exporter.ToExcel(Array.Empty<CertificateRegistryDto>()));
        Assert.NotEmpty(exporter.ToPdf(Array.Empty<CertificateRegistryDto>()));
    }
}
