using System.Security.Cryptography;

namespace EY.HRPlatform.Training.Features.Certifications.Services;

public class CertificateNumberGenerator : ICertificateNumberGenerator
{
    // Crockford base32 — excludes I, L, O, U to avoid ambiguity when read/typed by humans.
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    private const int SuffixLength = 8;

    public string Generate(int year)
    {
        var suffix = new char[SuffixLength];
        for (int i = 0; i < SuffixLength; i++)
            suffix[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];

        return $"EY-CERT-{year}-{new string(suffix)}";
    }
}
