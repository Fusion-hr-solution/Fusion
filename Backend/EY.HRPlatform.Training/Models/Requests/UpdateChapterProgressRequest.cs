using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateChapterProgressRequest
{
    [Required]
    public Guid ChapterId { get; set; }

    [Required]
    public bool Completed { get; set; }
}
