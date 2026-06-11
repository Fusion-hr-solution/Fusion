namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>
/// Produces high-entropy, non-enumerable certificate numbers of the form
/// <c>EY-CERT-{year}-{8 Crockford-base32}</c>. The same string is the public verify key + QR
/// target, so it must be unguessable. Uniqueness is enforced by a DB unique index; callers
/// regenerate on the (astronomically rare) collision.
/// </summary>
public interface ICertificateNumberGenerator
{
    string Generate(int year);
}
