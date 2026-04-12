using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ArticleTemplate : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    private readonly List<ArticleTemplateSection> _sections = [];
    public IReadOnlyCollection<ArticleTemplateSection> Sections => _sections.AsReadOnly();

    private ArticleTemplate() { }

    public ArticleTemplate(string name, string? description = null)
    {
        Name = name;
        Description = description;
    }

    public void AddSection(string label, string? placeholder, int orderIndex)
    {
        _sections.Add(new ArticleTemplateSection(label, placeholder, orderIndex, Id));
    }
}
