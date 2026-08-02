using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// Represents a tenant (client organization) in the HR platform.
/// </summary>
public class Tenant
{
    private Tenant() { } // EF constructor

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;
    /// <summary>Soft-offboarded customer; distinct from suspended (governance pause).</summary>
    public bool IsArchived { get; private set; }
    public string? InternalNotes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    /// <summary>
    /// Canonical bootstrap lifecycle. Provisioning creates a tenant awaiting
    /// administrator activation; successful bootstrap activation is the only
    /// supported transition to Active. This is distinct from the suspend and
    /// archive flags, which express separate administrative concerns.
    /// </summary>
    public TenantAdministratorActivationStatus AdministratorActivationStatus { get; private set; }
        = TenantAdministratorActivationStatus.AwaitingAdministratorActivation;

    /// <summary>Initial tenant locale, for example <c>en-US</c>.</summary>
    public string Locale { get; private set; } = DefaultLocale;

    /// <summary>Initial tenant IANA time zone, for example <c>Europe/Paris</c>.</summary>
    public string TimeZone { get; private set; } = DefaultTimeZone;

    /// <summary>Applied when a caller does not choose a locale.</summary>
    public const string DefaultLocale = "en-US";

    /// <summary>Applied to tenants that predate explicit time-zone selection.</summary>
    public const string DefaultTimeZone = "UTC";

    public const int LocaleMaxLength = 35;

    public const int TimeZoneMaxLength = 100;

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
            Slug = GenerateSlug(name),
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

    public static Tenant Create(Guid id, string name, string slug)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Id cannot be empty.", nameof(id));

        ValidateName(name);
        ValidateSlug(slug);

        return new Tenant
        {
            Id = id,
            Name = name.Trim(),
            Slug = slug.Trim().ToLowerInvariant(),
            IsActive = true,
            IsArchived = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    public static string GenerateSlug(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required to generate slug.", nameof(name));

        var slug = System.Text.RegularExpressions.Regex.Replace(
            name.Trim().ToLowerInvariant(),
            @"[^a-z0-9]+",
            "-").Trim('-');

        if (slug.Length > 100)
            slug = slug[..100].Trim('-');

        if (slug.Length == 0)
            slug = "tenant";

        return slug;
    }

    private static void ValidateSlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Slug is required.", nameof(slug));

        var trimmed = slug.Trim().ToLowerInvariant();
        if (trimmed.Length < 2 || trimmed.Length > 100)
            throw new ArgumentException("Slug must be 2-100 characters.", nameof(slug));

        if (!System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$"))
            throw new ArgumentException("Slug must contain only lowercase letters, digits, and hyphens, and cannot start or end with a hyphen.", nameof(slug));
    }

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
    /// Throws if already inactive or archived.
    /// </summary>
    public void Deactivate()
    {
        if (IsArchived)
            throw new InvalidOperationException("Cannot suspend an archived tenant.");
        if (!IsActive)
            throw new InvalidOperationException("Tenant is already suspended.");

        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Reactivates a suspended tenant.
    /// Throws if already active or archived.
    /// </summary>
    public void Reactivate()
    {
        if (IsActive && !IsArchived)
            throw new InvalidOperationException("Tenant is already active.");
        if (IsArchived)
            throw new InvalidOperationException("Cannot reactivate an archived tenant.");

        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Archives an offboarded customer (inactive + archived flag).
    /// Throws if already archived.
    /// </summary>
    public void Archive()
    {
        if (IsArchived)
            throw new InvalidOperationException("Tenant is already archived.");

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

    /// <summary>
    /// Applies the initial locale and time zone chosen during provisioning.
    /// </summary>
    public void ApplyInitialSettings(string? locale, string timeZone)
    {
        Locale = NormalizeLocale(locale);
        TimeZone = NormalizeTimeZone(timeZone);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marks the tenant Active after its Initial Tenant Administrator completes
    /// bootstrap activation. Called inside the activation transaction.
    /// </summary>
    public void CompleteAdministratorActivation()
    {
        if (AdministratorActivationStatus == TenantAdministratorActivationStatus.Active)
            throw new InvalidOperationException("Tenant administrator activation is already complete.");

        AdministratorActivationStatus = TenantAdministratorActivationStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public static string NormalizeLocale(string? locale)
    {
        if (string.IsNullOrWhiteSpace(locale))
            return DefaultLocale;

        var trimmed = locale.Trim();
        if (trimmed.Length > LocaleMaxLength)
            throw new ArgumentException($"Locale cannot exceed {LocaleMaxLength} characters.", nameof(locale));

        return trimmed;
    }

    public static string NormalizeTimeZone(string timeZone)
    {
        if (string.IsNullOrWhiteSpace(timeZone))
            throw new ArgumentException("Time zone is required.", nameof(timeZone));

        var trimmed = timeZone.Trim();
        if (trimmed.Length > TimeZoneMaxLength)
            throw new ArgumentException($"Time zone cannot exceed {TimeZoneMaxLength} characters.", nameof(timeZone));

        return trimmed;
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (name.Trim().Length < 2 || name.Trim().Length > 100)
            throw new ArgumentException("Name must be 2-100 characters.", nameof(name));
    }
}
