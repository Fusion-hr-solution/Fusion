using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Features.Accounts;

/// <summary>
/// The one place the account password rules are defined.
///
/// Registration configures Identity from here, tests validate against the same
/// rules rather than an approximation, and the public account-creation form is
/// told the same requirements instead of restating them in copy that can drift.
/// </summary>
public static class AccountPasswordPolicy
{
    public const int MinimumLength = 8;

    public static void Apply(PasswordOptions password)
    {
        password.RequireDigit = true;
        password.RequireLowercase = true;
        password.RequireUppercase = true;
        password.RequireNonAlphanumeric = true;
        password.RequiredLength = MinimumLength;
    }

    /// <summary>
    /// The rules as the recipient needs to understand them before typing, so the
    /// form can state its requirements without a second definition drifting from
    /// the one the service enforces.
    /// </summary>
    public static AccountPasswordRequirements Describe() => new(
        MinimumLength: MinimumLength,
        RequiresDigit: true,
        RequiresLowercase: true,
        RequiresUppercase: true,
        RequiresSymbol: true);
}

public sealed record AccountPasswordRequirements(
    int MinimumLength,
    bool RequiresDigit,
    bool RequiresLowercase,
    bool RequiresUppercase,
    bool RequiresSymbol);
