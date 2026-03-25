namespace EY.HRPlatform.Interview.Models.Questions;

public class QuestionFilterDto
{
    public string? Search { get; set; }
    public string[] Types { get; set; } = [];
    public string[] Difficulties { get; set; } = [];
    public string[] GradingMethods { get; set; } = [];
    public string Sort { get; set; } = "newest";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
