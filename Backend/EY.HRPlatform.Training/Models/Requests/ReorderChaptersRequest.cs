using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class ReorderChaptersRequest
{
    /// <summary>Ordered list of chapter IDs in their new order (index 0 = OrderIndex 0).</summary>
    [Required, MinLength(1)]
    public List<Guid> ChapterIds { get; set; } = [];
}
