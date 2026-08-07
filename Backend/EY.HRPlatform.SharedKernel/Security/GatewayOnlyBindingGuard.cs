using System.Net;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.SharedKernel.Security;

/// <summary>
/// Refuses to start a customer-facing module service that is reachable from
/// outside the host.
/// <para>
/// The Gateway validates on every authenticated request that the caller's tenant
/// access is still current. That check is only worth anything if the Gateway is
/// the only way in: a module service exposed directly would serve a suspended
/// administrator's token happily, because it never re-checks authority itself.
/// </para>
/// <para>
/// Rather than trusting a forwarded header — which anything reachable can send —
/// this fails the process at startup when the configured binding is not loopback.
/// An operator who genuinely terminates elsewhere sets
/// <c>Hosting:AllowNonLoopbackBinding</c> deliberately, which makes the decision
/// visible instead of accidental.
/// </para>
/// </summary>
public static class GatewayOnlyBindingGuard
{
    public const string AllowNonLoopbackKey = "Hosting:AllowNonLoopbackBinding";

    /// <summary>
    /// Throws when <paramref name="urls"/> contains a binding reachable from
    /// outside this host and the override is not set.
    /// </summary>
    public static void Verify(string serviceName, string? urls, IConfiguration configuration)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceName);

        if (configuration.GetValue<bool>(AllowNonLoopbackKey))
        {
            return;
        }

        var offending = ExternallyReachable(urls).ToList();

        if (offending.Count == 0)
        {
            return;
        }

        throw new InvalidOperationException(
            $"{serviceName} is configured to listen on {string.Join(", ", offending)}, which is reachable "
            + "without passing through the Gateway. Tenant access revocation is enforced at the Gateway, so a "
            + $"directly reachable module service would keep honouring withdrawn access. Bind to loopback, or set "
            + $"'{AllowNonLoopbackKey}' to true if another layer already restricts ingress.");
    }

    /// <summary>
    /// The bindings in <paramref name="urls"/> that accept traffic from outside
    /// this host. A wildcard host binds every interface, so it counts.
    /// </summary>
    public static IEnumerable<string> ExternallyReachable(string? urls)
    {
        if (string.IsNullOrWhiteSpace(urls))
        {
            yield break;
        }

        foreach (var candidate in urls.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            // Kestrel's wildcard hosts are checked before parsing, because "*" and
            // "+" are not legal URI hosts — Uri.TryCreate rejects them outright.
            // Treating an unparseable binding as safe would wave through exactly
            // the two forms most likely to expose a service in production.
            var host = ExtractHost(candidate);

            if (host is null)
            {
                continue;
            }

            if (host is "*" or "+" or "0.0.0.0" or "::" or "[::]")
            {
                yield return candidate;
                continue;
            }

            if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address))
            {
                continue;
            }

            yield return candidate;
        }
    }

    /// <summary>
    /// The host portion of a binding, without requiring it to be a legal URI.
    /// Returns null when there is nothing recognisable to judge.
    /// </summary>
    private static string? ExtractHost(string candidate)
    {
        var schemeEnd = candidate.IndexOf("://", StringComparison.Ordinal);

        if (schemeEnd < 0)
        {
            return null;
        }

        var rest = candidate[(schemeEnd + 3)..];

        if (rest.StartsWith('['))
        {
            var close = rest.IndexOf(']');
            return close > 0 ? rest[..(close + 1)] : null;
        }

        var end = rest.IndexOfAny([':', '/']);
        var host = end < 0 ? rest : rest[..end];

        return host.Length == 0 ? null : host;
    }
}
