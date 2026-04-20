using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class SubmitExamRequest
{
    [Required, MinLength(1)]
    public List<SubmitExamAnswerItem> Answers { get; set; } = [];
}

public class SubmitExamAnswerItem
{
    [Required]
    public Guid QuestionId { get; set; }

    /// <summary>Selected option ids. Empty means no answer (counts as incorrect).</summary>
    public List<Guid> SelectedOptionIds { get; set; } = [];
}
