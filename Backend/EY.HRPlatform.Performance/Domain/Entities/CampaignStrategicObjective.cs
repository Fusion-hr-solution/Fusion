using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class CampaignStrategicObjective : BaseEntity, ITenantEntity
{
    public const int TitleMaxLength = 200;
    public const int DescriptionMaxLength = 2000;
    public const int ResponsibleFunctionMaxLength = 120;

    private CampaignStrategicObjective() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? ResponsibleFunctionLabel { get; private set; }
    public bool IsActive { get; private set; }

    /// <summary>Row version for optimistic concurrency control (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    internal static CampaignStrategicObjective Create(
        Guid tenantId,
        Guid cycleId,
        string title,
        string? description,
        string? responsibleFunctionLabel)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("Campaign id cannot be empty.", nameof(cycleId));

        var objective = new CampaignStrategicObjective
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            IsActive = true
        };

        objective.Update(title, description, responsibleFunctionLabel);
        return objective;
    }

    internal void Update(string title, string? description, string? responsibleFunctionLabel)
    {
        Title = NormalizeRequired(title, nameof(title), TitleMaxLength);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        ResponsibleFunctionLabel = NormalizeOptional(
            responsibleFunctionLabel,
            nameof(responsibleFunctionLabel),
            ResponsibleFunctionMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetActive(bool isActive)
    {
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} is required.", paramName);

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }
}
