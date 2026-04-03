using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ArticleTemplateSection : BaseEntity
{
    public string Label { get; private set; } = string.Empty;
    public string? Placeholder { get; private set; }
    public int OrderIndex { get; private set; }

    public Guid TemplateId { get; private set; }
    public ArticleTemplate Template { get; private set; } = null!;

    private ArticleTemplateSection() { }

    public ArticleTemplateSection(string label, string? placeholder, int orderIndex, Guid templateId)
    {
        Label = label;
        Placeholder = placeholder;
        OrderIndex = orderIndex;
        TemplateId = templateId;
    }
}
