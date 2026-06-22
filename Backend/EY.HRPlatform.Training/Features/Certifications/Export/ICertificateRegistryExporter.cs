using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Certifications.Export;

/// <summary>Renders the certificate registry to Excel or PDF.</summary>
public interface ICertificateRegistryExporter
{
    byte[] ToExcel(IReadOnlyList<CertificateRegistryDto> rows);
    byte[] ToPdf(IReadOnlyList<CertificateRegistryDto> rows);
}
