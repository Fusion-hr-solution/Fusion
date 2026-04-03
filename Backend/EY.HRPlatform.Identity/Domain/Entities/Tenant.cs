namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// Represents a tenant (client organization) in the HR platform.
/// </summary>
public class Tenant
{
    private Tenant() { } // EF constructor

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;
    /// <summary>Soft-offboarded customer; distinct from suspended (governance pause).</summary>
    public bool IsArchived { get; private set; }
    public string? InternalNotes { get; private set; }
    public string? PlanTier { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    /// <summary>
    /// Creates a new tenant with validation.
    /// </summary>
    /// <param name="id">Unique identifier for the tenant.</param>
    /// <param name="name">Display name (2-100 characters).</param>
    /// <returns>A new Tenant instance.</returns>
    /// <exception cref="ArgumentException">Thrown when id is empty or name is invalid.</exception>
    public static Tenant Create(Guid id, string name)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Id cannot be empty.", nameof(id));

        ValidateName(name);

        return new Tenant
        {
            Id = id,
            Name = name.Trim(),
            IsActive = true,
            IsArchived = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a new tenant with an auto-generated ID.
    /// </summary>
    /// <param name="name">Display name (2-100 characters).</param>
    /// <returns>A new Tenant instance.</returns>
    public static Tenant Create(string name) => Create(Guid.NewGuid(), name);

    /// <summary>
    /// Updates the tenant name.
    /// </summary>
    /// <param name="name">New display name (2-100 characters).</param>
    public void Update(string name)
    {
        ValidateName(name);

        Name = name.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Deactivates the tenant (access suspended).
    /// </summary>
    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Reactivates a suspended tenant (clears archived flag).
    /// </summary>
    public void Reactivate()
    {
        IsActive = true;
        IsArchived = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Archives an offboarded customer (inactive + archived flag).
    /// </summary>
    public void Archive()
    {
        IsArchived = true;
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Platform admin notes (not visible to tenant users).</summary>
    public void SetInternalNotes(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
        {
            InternalNotes = null;
        }
        else
        {
            var t = notes.Trim();
            if (t.Length > 4000)
                throw new ArgumentException("Internal notes cannot exceed 4000 characters.", nameof(notes));
            InternalNotes = t;
        }

        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Optional commercial / operational tier label.</summary>
    public void SetPlanTier(string? tier)
    {
        if (string.IsNullOrWhiteSpace(tier))
        {
            PlanTier = null;
        }
        else
        {
            var t = tier.Trim();
            if (t.Length > 100)
                throw new ArgumentException("Plan tier cannot exceed 100 characters.", nameof(tier));
            PlanTier = t;
        }

        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (name.Trim().Length < 2 || name.Trim().Length > 100)
            throw new ArgumentException("Name must be 2-100 characters.", nameof(name));
    }
}
