using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class Certification : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;
    public string? CertificateUri { get; private set; }
    public DateTime IssuedAt { get; private set; } = DateTime.UtcNow;

    private Certification() { }

    public Certification(Guid employeeId, Guid trainingId, string? certificateUri = null)
    {
        EmployeeId = employeeId;
        TrainingId = trainingId;
        CertificateUri = certificateUri;
    }
}
