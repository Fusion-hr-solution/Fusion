namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>Renders a QR code (PNG bytes) for the given content, e.g. a verification URL.</summary>
public interface ICertificateQrService
{
    byte[] GeneratePng(string content);
}
