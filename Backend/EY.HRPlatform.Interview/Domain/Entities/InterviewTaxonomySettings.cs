using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

/// <summary>
/// Singleton row holding the admin's taxonomy overrides. Only overrides are stored — the canonical
/// lists live in <see cref="InterviewTaxonomy"/> and are merged over these on read, so a list that
/// has never been edited needs no row and a new enum member appears without a data migration.
/// </summary>
/// <remarks>
/// One JSON document rather than a normalized item table: nothing queries it relationally, so
/// adding a list later is a data change instead of a migration. Plain <c>text</c> rather than
/// <c>jsonb</c> because we never query into it — and <c>jsonb</c> is ignored by the in-memory
/// provider the tests use anyway.
/// </remarks>
public class InterviewTaxonomySettings : AggregateRoot
{
    public string OverridesJson { get; set; } = "{}";

    /// <summary>Incremented on every save. Surfaced so a future optimistic-concurrency check can
    /// be added without a migration.</summary>
    public int Version { get; set; }

    public void SetCreatedAt(DateTime createdAt)
    {
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public void SetUpdatedAt(DateTime updatedAt)
    {
        UpdatedAt = updatedAt;
    }
}
