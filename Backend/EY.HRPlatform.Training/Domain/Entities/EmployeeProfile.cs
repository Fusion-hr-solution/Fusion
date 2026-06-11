using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class EmployeeProfile : BaseEntity
{
    public Guid EmployeeId { get; private set; }

    // Identity snapshot synced from the Identity service (no FK; refreshed via SetIdentity).
    public string? FullName { get; private set; }
    public string? Email { get; private set; }

    public Guid? GradeId { get; private set; }
    public Grade? Grade { get; private set; }

    public Guid? ServiceLineId { get; private set; }
    public ServiceLine? ServiceLine { get; private set; }

    private EmployeeProfile() { }

    public EmployeeProfile(Guid employeeId, Guid? gradeId, Guid? serviceLineId, string? fullName = null, string? email = null)
    {
        EmployeeId = employeeId;
        GradeId = gradeId;
        ServiceLineId = serviceLineId;
        FullName = fullName;
        Email = email;
    }

    public void Update(Guid? gradeId, Guid? serviceLineId)
    {
        GradeId = gradeId;
        ServiceLineId = serviceLineId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Idempotently refreshes the identity snapshot synced from the Identity service.</summary>
    public void SetIdentity(string? fullName, string? email)
    {
        FullName = fullName;
        Email = email;
        UpdatedAt = DateTime.UtcNow;
    }
}
