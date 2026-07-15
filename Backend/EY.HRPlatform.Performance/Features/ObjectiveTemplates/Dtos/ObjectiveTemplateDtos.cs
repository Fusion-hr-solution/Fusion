using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;

public sealed record ObjectiveTemplateDto(
    Guid Id,
    string Name,
    string? Description,
    string? Category,
    string Level,
    Guid? ParentTemplateId,
    string? SuccessMeasure,
    string? Target,
    bool IsReadyForPlanning,
    decimal? DefaultWeight,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

public sealed record CreateObjectiveTemplateRequest(
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight,
    string? SuccessMeasure = null,
    string? Target = null,
    string Level = "Individual",
    Guid? ParentTemplateId = null);

public sealed record UpdateObjectiveTemplateRequest(
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight,
    string? SuccessMeasure = null,
    string? Target = null,
    string Level = "Individual",
    Guid? ParentTemplateId = null);

public static class ObjectiveTemplateMapper
{
    public static ObjectiveTemplateDto ToDto(ObjectiveTemplate template)
        => new(
            template.Id,
            template.Name,
            template.Description,
            template.Category,
            template.Level.ToString(),
            template.ParentTemplateId,
            template.SuccessMeasure,
            template.Target,
            template.IsReadyForPlanning,
            template.DefaultWeight,
            template.Status.ToString(),
            template.CreatedAt,
            template.UpdatedAt,
            template.Version);
}
