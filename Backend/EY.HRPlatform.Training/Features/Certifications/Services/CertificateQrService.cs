using QRCoder;

namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>
/// QR rendering via QRCoder's <see cref="PngByteQRCode"/> — a pure-managed PNG renderer with no
/// System.Drawing dependency, so it runs unchanged on Linux/Docker.
/// </summary>
public class CertificateQrService : ICertificateQrService
{
    public byte[] GeneratePng(string content)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(content);

        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(data);
        return png.GetGraphic(20);
    }
}
