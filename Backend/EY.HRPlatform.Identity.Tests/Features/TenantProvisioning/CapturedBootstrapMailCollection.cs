namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// The capturing sender keeps its messages in one process-wide list, and the
/// classes that read it clear it and look messages up by the same address. Run
/// in parallel, one class's provisioning or Clear() lands between another's send
/// and read, so they share a collection and run one after another.
/// </summary>
[CollectionDefinition(Name)]
public sealed class CapturedBootstrapMailCollection
{
    public const string Name = "Captured bootstrap mail";
}
