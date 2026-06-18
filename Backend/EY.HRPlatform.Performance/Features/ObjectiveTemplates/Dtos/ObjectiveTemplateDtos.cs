using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;

public sealed record ObjectiveTemplateDto(
    Guid Id,
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

public sealed record CreateObjectiveTemplateRequest(
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight);

public sealed record UpdateObjectiveTemplateRequest(
    string Name,
    string? Description,
    string? Category,
    decimal? DefaultWeight);

public static class ObjectiveTemplateMapper
{
    public static ObjectiveTemplateDto ToDto(ObjectiveTemplate template)
        => new(
            template.Id,
            template.Name,
            template.Description,
            template.Category,
            template.DefaultWeight,
            template.Status.ToString(),
            template.CreatedAt,
            template.UpdatedAt,
            template.Version);
}
