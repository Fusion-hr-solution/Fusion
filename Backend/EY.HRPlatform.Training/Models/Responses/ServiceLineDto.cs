namespace EY.HRPlatform.Training.Models.Responses;

public class ServiceLineDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = string.Empty;
    public bool IsSharedAcrossAllServiceLines { get; set; }
}
