using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Settings;

/// <summary>An immutable copy of the ordered labels used by future review rounds.</summary>
public sealed class RatingScaleVersion : PerformanceChildEntity
{
    private RatingScaleVersion() { }

    public Guid RatingScaleId { get; private set; }
    public int Number { get; private set; }
    public string LevelsJson { get; private set; } = "[]";

    public IReadOnlyList<RatingScaleLevel> Levels
        => JsonSerializer.Deserialize<RatingScaleLevel[]>(LevelsJson) ?? [];

    internal static RatingScaleVersion Create(Guid tenantId, Guid scaleId, int number, IReadOnlyList<RatingScaleLevel> levels)
        => new()
        {
            TenantId = tenantId,
            RatingScaleId = scaleId,
            Number = number,
            LevelsJson = JsonSerializer.Serialize(levels),
        };
}
