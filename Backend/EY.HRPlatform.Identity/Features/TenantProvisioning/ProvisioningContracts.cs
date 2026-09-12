using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

/// <summary>
/// Reads a module list written as names. An unknown name is rejected as invalid
/// input rather than silently dropped, so a caller never believes it entitled a
/// module the platform ignored.
/// </summary>
public sealed class JsonStringEnumListConverter : JsonConverter<IReadOnlyList<TenantModule>>
{
    public override IReadOnlyList<TenantModule> Read(
        ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return [];
        }

        if (reader.TokenType != JsonTokenType.StartArray)
        {
            throw new JsonException("Modules must be an array of module names.");
        }

        var modules = new List<TenantModule>();

        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            var name = reader.TokenType switch
            {
                JsonTokenType.String => reader.GetString(),
                _ => throw new JsonException("Each module must be a module name."),
            };

            if (!Enum.TryParse<TenantModule>(name, ignoreCase: true, out var module)
                || !Enum.IsDefined(module))
            {
                throw new JsonException($"'{name}' is not a supported module.");
            }

            modules.Add(module);
        }

        return modules;
    }

    public override void Write(
        Utf8JsonWriter writer, IReadOnlyList<TenantModule> value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var module in value)
        {
            writer.WriteStringValue(module.ToString());
        }
        writer.WriteEndArray();
    }
}

/// <summary>
/// A Platform Administrator's request to provision one customer tenant.
/// </summary>
public sealed record ProvisionTenantRequest
{
    /// <summary>
    /// Separates fields inside the canonical fingerprint input. A control
    /// character cannot appear in any field, so two different requests cannot
    /// collide by running their values together.
    /// </summary>
    private const char FieldSeparator = '\u001F';

    public string Name { get; init; } = string.Empty;

    /// <summary>Optional; falls back to the tenant default when absent.</summary>
    public string? Locale { get; init; }

    public string TimeZone { get; init; } = string.Empty;

    /// <summary>
    /// Optional modules. Core HR is mandatory and is added regardless, so a caller
    /// cannot deselect it by omitting it.
    ///
    /// Named rather than numeric: every projection reports modules by name, so
    /// requests use the same vocabulary the responses do.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumListConverter))]
    public IReadOnlyList<TenantModule> Modules { get; init; } = [];

    public string AdministratorEmail { get; init; } = string.Empty;

    /// <summary>
    /// Optional. Pre-fills the first administrator's name on the activation form
    /// so they are not asked to retype what the operator already knows. Cosmetic:
    /// it is not part of the idempotency fingerprint, and the recipient can still
    /// correct it when they set up their account.
    /// </summary>
    public string? AdministratorFirstName { get; init; }
    public string? AdministratorLastName { get; init; }

    /// <summary>Caller-supplied key that makes a retry idempotent.</summary>
    public string IdempotencyKey { get; init; } = string.Empty;

    /// <summary>
    /// Canonical fingerprint of the meaningful request content.
    ///
    /// Normalization is deliberate: the same intent expressed with different
    /// casing, whitespace, or module ordering must produce the same fingerprint,
    /// so an honest retry is recognised as identical. Anything that would change
    /// the provisioned result must change the fingerprint, so key reuse with
    /// different input is caught as a conflict rather than silently returning the
    /// first result.
    /// </summary>
    public string ComputeFingerprint()
    {
        var modules = NormalizedModules()
            .Select(module => module.ToString())
            .OrderBy(value => value, StringComparer.Ordinal);

        // Unit separator cannot occur in these values, so fields cannot run
        // together and two different requests cannot collide by concatenation.
        var canonical = string.Join(FieldSeparator, [
            Name.Trim().ToLowerInvariant(),
            NormalizeLocale(Locale).ToLowerInvariant(),
            TimeZone.Trim().ToLowerInvariant(),
            string.Join(',', modules),
            AdministratorEmail.Trim().ToLowerInvariant(),
        ]);

        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    /// <summary>
    /// The modules actually provisioned: the caller's selection plus mandatory
    /// Core HR, de-duplicated.
    /// </summary>
    /// <summary>Shared locale normalization so fingerprint and persistence agree.</summary>
    public static string NormalizeLocale(string? locale)
        => string.IsNullOrWhiteSpace(locale)
            ? Domain.Entities.Tenant.DefaultLocale
            : locale.Trim();

    public IReadOnlyList<TenantModule> NormalizedModules()
        => Modules.Append(TenantModule.CoreHR).Distinct().OrderBy(module => module).ToList();
}

/// <summary>Identifiers of a completed provisioning, returned to the caller.</summary>
public sealed record ProvisionTenantResult(
    Guid TenantId,
    Guid BootstrapInvitationId,
    DateTime CompletedAt);

/// <summary>Why a provisioning request could not be completed.</summary>
public enum ProvisioningFailure
{
    /// <summary>Request content is invalid and identifies resolvable fields.</summary>
    Validation = 0,

    /// <summary>The idempotency key exists with a different request fingerprint.</summary>
    IdempotencyConflict = 1,

    /// <summary>Another tenant already uses this name.</summary>
    DuplicateTenantName = 2,
}

