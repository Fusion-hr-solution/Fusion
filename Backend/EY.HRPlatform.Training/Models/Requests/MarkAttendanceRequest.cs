using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class MarkAttendanceRequest
{
    [Required]
    public Guid SessionId { get; set; }

    [Required]
    public Guid EmployeeId { get; set; }
}
