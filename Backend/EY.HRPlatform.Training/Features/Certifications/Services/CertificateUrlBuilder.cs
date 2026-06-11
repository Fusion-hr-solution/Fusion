namespace EY.HRPlatform.Training.Features.Certifications.Services;

public class CertificateUrlBuilder : ICertificateUrlBuilder
{
    private const string DefaultBaseUrl = "http://localhost:3000";

    private readonly IConfiguration _configuration;

    public CertificateUrlBuilder(IConfiguration configuration) => _configuration = configuration;

    public string BuildVerificationUrl(string certificateNumber)
    {
        var baseUrl = _configuration["Certificates:VerificationBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            baseUrl = DefaultBaseUrl;

        return $"{baseUrl.TrimEnd('/')}/learning/verify/{certificateNumber}";
    }
}
