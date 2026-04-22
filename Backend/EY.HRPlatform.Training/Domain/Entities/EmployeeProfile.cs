using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class EmployeeProfile : BaseEntity
{
    public Guid EmployeeId { get; private set; }

    public Guid? GradeId { get; private set; }
    public Grade? Grade { get; private set; }

    public Guid? ServiceLineId { get; private set; }
    public ServiceLine? ServiceLine { get; private set; }

    private EmployeeProfile() { }

    public EmployeeProfile(Guid employeeId, Guid? gradeId, Guid? serviceLineId)
    {
        EmployeeId = employeeId;
        GradeId = gradeId;
        ServiceLineId = serviceLineId;
    }

    public void Update(Guid? gradeId, Guid? serviceLineId)
    {
        GradeId = gradeId;
        ServiceLineId = serviceLineId;
        UpdatedAt = DateTime.UtcNow;
    }
}
