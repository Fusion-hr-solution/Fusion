using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class Badge : AggregateRoot
{
    public string Name { get; private set; } = string.Empty;
    public BadgeLevel Level { get; private set; }
    public string? Description { get; private set; }

    private readonly List<EmployeeBadge> _employeeBadges = [];
    public IReadOnlyCollection<EmployeeBadge> EmployeeBadges => _employeeBadges.AsReadOnly();

    private Badge() { }

    public Badge(string name, BadgeLevel level, string? description = null)
    {
        Name = name;
        Level = level;
        Description = description;
    }
}
