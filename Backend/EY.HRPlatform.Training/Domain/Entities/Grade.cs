using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class Grade : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public int Level { get; private set; }
    public string? Description { get; private set; }
    public string? Icon { get; private set; }

    private Grade() { }

    public Grade(string name, int level, string? description = null, string? icon = null)
    {
        Name = name;
        Level = level;
        Description = description;
        Icon = icon;
    }

    public void Update(string name, int level, string? description, string? icon)
    {
        Name = name;
        Level = level;
        Description = description;
        Icon = icon;
        UpdatedAt = DateTime.UtcNow;
    }
}
