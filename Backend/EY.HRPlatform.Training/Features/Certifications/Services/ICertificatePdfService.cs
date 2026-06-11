using EY.HRPlatform.Training.Domain.Entities;

namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>
/// Renders the nominative certificate PDF from a (fully-snapshotted) <see cref="Certification"/>,
/// the pre-rendered QR PNG, and the public verification URL. Deterministic: the same certificate
/// always renders the same document, so the stored PDF is a regenerable cache.
/// </summary>
public interface ICertificatePdfService
{
    byte[] Generate(Certification certificate, byte[] qrPng, string verificationUrl);
}
