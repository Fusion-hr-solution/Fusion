using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class CurriculumMapping : BaseEntity
{
    public Guid GradeId { get; private set; }
    public Grade Grade { get; private set; } = null!;

    public Guid ServiceLineId { get; private set; }
    public ServiceLine ServiceLine { get; private set; } = null!;

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    public bool IsRequired { get; private set; } = true;
    public int OrderIndex { get; private set; }

    private CurriculumMapping() { }

    public CurriculumMapping(Guid gradeId, Guid serviceLineId, Guid trainingId, bool isRequired, int orderIndex)
    {
        GradeId = gradeId;
        ServiceLineId = serviceLineId;
        TrainingId = trainingId;
        IsRequired = isRequired;
        OrderIndex = orderIndex;
    }

    public void UpdateIsRequired(bool isRequired)
    {
        IsRequired = isRequired;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetOrderIndex(int orderIndex)
    {
        OrderIndex = orderIndex;
        UpdatedAt = DateTime.UtcNow;
    }
}
