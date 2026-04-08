namespace EY.HRPlatform.Training.Models.Responses;

public class ArticleTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<ArticleTemplateSectionDto> Sections { get; set; } = [];
}

public class ArticleTemplateSectionDto
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string? Placeholder { get; set; }
    public int OrderIndex { get; set; }
}
