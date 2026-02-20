using System;
using System.Collections.Generic;
using System.Text;

using System.Security.Claims;

namespace EY.HRPlatform.SharedKernel.Auth;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID claim not found.");
        return Guid.Parse(claim.Value);
    }

    public static string GetEmail(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value
            ?? throw new InvalidOperationException("Email claim not found.");
    }

    public static bool IsInRole(this ClaimsPrincipal principal, string role)
    {
        return principal.IsInRole(role);
    }

    public static string GetFullName(this ClaimsPrincipal principal)
    {
        return principal.FindFirst("full_name")?.Value ?? "Unknown";
    }
}