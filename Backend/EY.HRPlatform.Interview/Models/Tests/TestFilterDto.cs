namespace EY.HRPlatform.Interview.Models.Tests;

public class TestFilterDto
{
    public string? Search { get; set; }
    public string? Discipline { get; set; }
    public string? QuestionType { get; set; }
    public string? Status { get; set; }
    public string Sort { get; set; } = "newest";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}   