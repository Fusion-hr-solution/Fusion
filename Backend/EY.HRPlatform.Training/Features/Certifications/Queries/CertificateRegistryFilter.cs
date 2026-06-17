using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

/// <summary>Shared filter predicate for the certificate registry (paged list + export).</summary>
internal static class CertificateRegistryFilter
{
    public static IQueryable<Certification> Apply(
        IQueryable<Certification> query,
        Guid? trainingId, Guid? gradeId, DateTime? from, DateTime? to, string? status, string? search)
    {
        if (trainingId.HasValue)
            query = query.Where(c => c.TrainingId == trainingId.Value);

        if (gradeId.HasValue)
            query = query.Where(c => c.GradeId == gradeId.Value);

        if (from.HasValue)
            query = query.Where(c => c.IssuedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(c => c.IssuedAt <= to.Value);

        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<CertificateStatus>(status, true, out var statusFilter))
            query = query.Where(c => c.Status == statusFilter);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c => c.CertificateNumber.Contains(term) || c.EmployeeFullName.Contains(term));
        }

        return query;
    }
}
