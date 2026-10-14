using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Settings;

public enum CompetencyState { Active, Archived }

public sealed class Competency : PerformanceAggregate
{
    private Competency() { }

    public string Name { get; private set; } = string.Empty;
    public string NameKey { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string BehaviorsJson { get; private set; } = "[]";
    public CompetencyState State { get; private set; }
    public DateTime? FirstUsedAt { get; private set; }

    public IReadOnlyList<string> Behaviors => System.Text.Json.JsonSerializer.Deserialize<string[]>(BehaviorsJson) ?? [];

    public static Competency Create(Guid tenantId, string name, string description, IReadOnlyList<string>? behaviors)
    {
        var normalized = Normalize(name, description, behaviors);
        return new Competency { TenantId = tenantId, Name = normalized.Name, NameKey = normalized.Name.ToUpperInvariant(),
            Description = normalized.Description, BehaviorsJson = System.Text.Json.JsonSerializer.Serialize(normalized.Behaviors), State = CompetencyState.Active };
    }

    public void Update(string name, string description, IReadOnlyList<string>? behaviors)
    {
        if (State != CompetencyState.Active) throw new InvalidOperationException("Archived competencies cannot be edited.");
        var normalized = Normalize(name, description, behaviors);
        Name = normalized.Name;
        NameKey = normalized.Name.ToUpperInvariant();
        Description = normalized.Description;
        BehaviorsJson = System.Text.Json.JsonSerializer.Serialize(normalized.Behaviors);
        MarkUpdated();
    }

    public void Archive()
    {
        if (State == CompetencyState.Archived) return;
        State = CompetencyState.Archived;
        MarkUpdated();
    }

    public void MarkUsed(DateTime at)
    {
        if (State != CompetencyState.Active) throw new InvalidOperationException("Only active competencies can be used.");
        if (FirstUsedAt is null) { FirstUsedAt = at; MarkUpdated(); }
    }

    private static (string Name, string Description, string[] Behaviors) Normalize(string name, string description, IReadOnlyList<string>? behaviors)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 160) throw new ArgumentException("Enter a competency name of 160 characters or fewer.", nameof(name));
        if (string.IsNullOrWhiteSpace(description) || description.Trim().Length > 2000) throw new ArgumentException("Enter a competency description of 2,000 characters or fewer.", nameof(description));
        var cleaned = (behaviors ?? []).Select(value => value?.Trim() ?? string.Empty).Where(value => value.Length > 0).ToArray();
        if (cleaned.Length > 20 || cleaned.Any(value => value.Length > 500)) throw new ArgumentException("Use up to 20 behaviors, each 500 characters or fewer.", nameof(behaviors));
        return (name.Trim(), description.Trim(), cleaned);
    }
}
