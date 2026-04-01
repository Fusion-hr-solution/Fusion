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
    /// Deactivates the tenant (soft delete).
    /// </summary>
    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Reactivates a previously deactivated tenant.
    /// </summary>
    public void Reactivate()
    {
        IsActive = true;
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
