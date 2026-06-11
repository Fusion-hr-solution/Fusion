namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>Builds the public verification URL (QR target + printed link) for a certificate number.</summary>
public interface ICertificateUrlBuilder
{
    string BuildVerificationUrl(string certificateNumber);
}
