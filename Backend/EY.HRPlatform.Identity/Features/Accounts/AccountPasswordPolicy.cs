using System.Linq;
using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Features.Accounts;

/// <summary>
/// The one place the account password rules are defined.
///
/// Registration configures Identity from here, tests validate against the same
/// rules rather than an approximation, and the public account-creation form is
/// told the same requirements instead of restating them in copy that can drift.
///
/// The policy is deliberately simple: long enough to be safe, one letter and one
/// number so it is not trivial, and nothing else mandatory. Uppercase and
/// symbols are allowed and strengthen a password, but requiring a fixed
/// composition adds friction without meaningfully improving security.
/// </summary>
public static class AccountPasswordPolicy
{
    public const int MinimumLength = 10;

    /// <summary>
    /// An upper bound, generous enough never to obstruct a real passphrase but
    /// present so a single request cannot submit an unbounded string.
    /// </summary>
    public const int MaximumLength = 128;

    public static void Apply(PasswordOptions password)
    {
        password.RequireDigit = true;
        // A letter of either case is required through a dedicated validator,
        // because Identity can only demand a lowercase and an uppercase letter
        // separately, never "a letter, either case".
        password.RequireLowercase = false;
        password.RequireUppercase = false;
        password.RequireNonAlphanumeric = false;
        password.RequiredLength = MinimumLength;
    }

    /// <summary>
    /// The rules as the recipient needs to understand them before typing, so the
    /// form can state its requirements without a second definition drifting from
    /// the one the service enforces.
    /// </summary>
    public static AccountPasswordRequirements Describe() => new(
        MinimumLength: MinimumLength,
        MaximumLength: MaximumLength,
        RequiresLetter: true,
        RequiresDigit: true,
        RequiresLowercase: false,
        RequiresUppercase: false,
        RequiresSymbol: false);
}

public sealed record AccountPasswordRequirements(
    int MinimumLength,
    int MaximumLength,
    bool RequiresLetter,
    bool RequiresDigit,
    bool RequiresLowercase,
    bool RequiresUppercase,
    bool RequiresSymbol);

/// <summary>
/// Enforces "contains at least one letter" (either case), the rule ASP.NET
/// Identity's built-in options cannot express on their own.
/// </summary>
public sealed class LetterPasswordValidator : IPasswordValidator<ApplicationUser>
{
    public Task<IdentityResult> ValidateAsync(
        UserManager<ApplicationUser> manager,
        ApplicationUser user,
        string? password)
    {
        if (!string.IsNullOrEmpty(password) && password.Any(char.IsLetter))
        {
            return Task.FromResult(IdentityResult.Success);
        }

        return Task.FromResult(IdentityResult.Failed(new IdentityError
        {
            Code = "PasswordRequiresLetter",
            Description = "Passwords must contain at least one letter.",
        }));
    }
}

/// <summary>
/// Caps password length so a single request cannot submit an unbounded string;
/// Identity enforces a minimum but no maximum.
/// </summary>
public sealed class MaximumLengthPasswordValidator : IPasswordValidator<ApplicationUser>
{
    public Task<IdentityResult> ValidateAsync(
        UserManager<ApplicationUser> manager,
        ApplicationUser user,
        string? password)
    {
        if ((password?.Length ?? 0) <= AccountPasswordPolicy.MaximumLength)
        {
            return Task.FromResult(IdentityResult.Success);
        }

        return Task.FromResult(IdentityResult.Failed(new IdentityError
        {
            Code = "PasswordTooLong",
            Description =
                $"Passwords must be {AccountPasswordPolicy.MaximumLength} characters or fewer.",
        }));
    }
}
