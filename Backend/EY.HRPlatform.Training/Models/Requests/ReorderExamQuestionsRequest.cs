using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class ReorderExamQuestionsRequest
{
    [Required, MinLength(1)]
    public List<Guid> QuestionIds { get; set; } = [];
}
