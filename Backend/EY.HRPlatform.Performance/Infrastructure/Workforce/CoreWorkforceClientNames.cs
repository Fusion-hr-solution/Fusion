namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// DI keys for the two Core HR client policies (design D9). Inject
/// <c>[FromKeyedServices(CoreWorkforceClientNames.Bulk)] ICoreWorkforceClient</c> on a call site
/// that resolves a whole workforce; everything else takes the unkeyed interactive client.
/// </summary>
public static class CoreWorkforceClientNames
{
    public const string Interactive = "core-workforce-interactive";
    public const string Bulk = "core-workforce-bulk";
}
