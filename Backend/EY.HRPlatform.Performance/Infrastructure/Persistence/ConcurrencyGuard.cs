using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

/// <summary>
/// Enforces the client's optimistic-concurrency expectation (If-Match version) against the
/// freshly loaded entity version. EF still guards against races between load and save via the
/// rowversion (xmin) in the generated UPDATE; this guard rejects an already-stale caller up front.
/// </summary>
internal static class ConcurrencyGuard
{
    public static void Ensure(uint actualVersion, uint expectedVersion, string entityType, Guid entityId)
    {
        if (actualVersion != expectedVersion)
        {
            throw new ConcurrencyException(entityType, entityId);
        }
    }
}
