using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateOnSiteCourseRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string ContentUri { get; set; } = string.Empty;

    public int OrderIndex { get; set; }
}
