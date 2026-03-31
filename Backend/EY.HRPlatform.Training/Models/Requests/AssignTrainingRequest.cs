using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class AssignTrainingRequest
{
    [Required]
    public Guid TrainingId { get; set; }

    [Required]
    public Guid EmployeeId { get; set; }

    public DateTime? DueDate { get; set; }
}
