namespace EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;

public sealed record CategoryDto(Guid Id, string Code, string Name, string Status);

public sealed record CreateCategoryRequest(string Code, string Name);

public sealed record RenameCategoryRequest(string Name);
