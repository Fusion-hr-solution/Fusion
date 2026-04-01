namespace EY.HRPlatform.Training.Models.Responses;

public class AssignmentDto
{
    public Guid Id { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public Guid EmployeeId { get; set; }
    public string AssignmentType { get; set; } = string.Empty;
    public DateTime AssignedAt { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Status { get; set; }
    public int ProgressPercentage { get; set; }
}
