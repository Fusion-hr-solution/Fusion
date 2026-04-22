using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ServiceLine : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Color { get; private set; } = "#000000";
    public bool IsSharedAcrossAllServiceLines { get; private set; }

    private ServiceLine() { }

    public ServiceLine(string name, string code, string color, string? description = null, bool isSharedAcrossAllServiceLines = false)
    {
        Name = name;
        Code = code;
        Color = color;
        Description = description;
        IsSharedAcrossAllServiceLines = isSharedAcrossAllServiceLines;
    }

    public void Update(string name, string code, string color, string? description, bool isSharedAcrossAllServiceLines)
    {
        Name = name;
        Code = code;
        Color = color;
        Description = description;
        IsSharedAcrossAllServiceLines = isSharedAcrossAllServiceLines;
        UpdatedAt = DateTime.UtcNow;
    }
}
