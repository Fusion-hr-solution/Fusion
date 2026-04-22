using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpsertEmployeeProfileRequest
{
    public Guid? GradeId { get; set; }
    public Guid? ServiceLineId { get; set; }
}
