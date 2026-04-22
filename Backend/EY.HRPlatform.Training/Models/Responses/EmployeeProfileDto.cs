namespace EY.HRPlatform.Training.Models.Responses;

public class EmployeeProfileDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid? GradeId { get; set; }
    public string? GradeName { get; set; }
    public Guid? ServiceLineId { get; set; }
    public string? ServiceLineName { get; set; }
    public string? ServiceLineColor { get; set; }
}
