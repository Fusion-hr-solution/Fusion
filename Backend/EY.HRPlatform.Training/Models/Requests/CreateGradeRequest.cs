using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateGradeRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Range(1, 999)]
    public int Level { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; }
}
