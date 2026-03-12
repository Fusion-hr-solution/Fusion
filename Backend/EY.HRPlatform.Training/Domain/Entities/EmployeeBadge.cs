using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class EmployeeBadge : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public Guid BadgeId { get; private set; }
    public Badge Badge { get; private set; } = null!;
    public DateTime EarnedAt { get; private set; } = DateTime.UtcNow;

    private EmployeeBadge() { }

    public EmployeeBadge(Guid employeeId, Guid badgeId)
    {
        EmployeeId = employeeId;
        BadgeId = badgeId;
    }
}
