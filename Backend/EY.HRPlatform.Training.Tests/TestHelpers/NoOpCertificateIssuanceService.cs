using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Certifications.Services;

namespace EY.HRPlatform.Training.Tests.TestHelpers;

/// <summary>
/// No-op certificate issuance for handler tests that assert on progress/completion rather than on
/// certificate creation. Certificate generation itself is covered by CertificateGenerationTests.
/// </summary>
public sealed class NoOpCertificateIssuanceService : ICertificateIssuanceService
{
    public static readonly NoOpCertificateIssuanceService Instance = new();

    public Task<Certification?> IssueForCompletionAsync(
        Guid employeeId, Guid trainingId, string? fullNameFromContext, CancellationToken cancellationToken)
        => Task.FromResult<Certification?>(null);
}
