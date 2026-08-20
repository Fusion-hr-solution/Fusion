using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public interface IEmployeeNumberAllocator
{
    Task<string> AllocateAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Bulk-reserve <paramref name="count"/> numbers in one pass: acquire the tenant lock once,
    /// preload existing numbers once, advance the allocator in memory skipping collisions, and
    /// persist the final allocator state once. Avoids the per-row DB round trip and O(n²) local
    /// scans of calling <see cref="AllocateAsync"/> per employee. Gaps are acceptable.
    /// </summary>
    Task<IReadOnlyList<string>> AllocateManyAsync(int count, ISet<string> alreadyReserved, CancellationToken cancellationToken = default);
}

/// <summary>
/// Allocates an opaque tenant-local sequence while the caller owns the surrounding transaction.
/// The tenant advisory lock is deliberately narrow: it serializes generated numbers only.
/// </summary>
public sealed class EmployeeNumberAllocatorService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : IEmployeeNumberAllocator
{
    private const string Prefix = "EMP-";
    private const int Digits = 8;
    private const long LockNamespace = 0x454D504E554D4245;

    public async Task<string> AllocateAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = tenantContext.TenantId;
        if (dbContext.Database.IsRelational() && dbContext.Database.CurrentTransaction is null)
            throw new InvalidOperationException(
                "Employee Number allocation must run inside the workforce write transaction.");

        if (dbContext.Database.IsNpgsql())
        {
            var key = BitConverter.ToInt64(tenantId.ToByteArray(), 0) ^ LockNamespace;
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({key})", cancellationToken);
        }

        var allocator = dbContext.EmployeeNumberAllocators.Local
            .SingleOrDefault(x => x.TenantId == tenantId)
            ?? await dbContext.EmployeeNumberAllocators
                .SingleOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (allocator is null)
        {
            allocator = EmployeeNumberAllocator.Create(tenantId);
            dbContext.EmployeeNumberAllocators.Add(allocator);
        }

        while (true)
        {
            var candidate = Format(allocator.TakeNext());
            var trackedCollision = dbContext.Employees.Local.Any(employee =>
                employee.TenantId == tenantId && employee.EmployeeNumber == candidate);
            var persistedCollision = trackedCollision || await dbContext.Employees
                .AsNoTracking()
                .AnyAsync(employee => employee.EmployeeNumber == candidate, cancellationToken);

            if (!persistedCollision)
                return candidate;
        }
    }

    public async Task<IReadOnlyList<string>> AllocateManyAsync(int count, ISet<string> alreadyReserved, CancellationToken cancellationToken = default)
    {
        if (count <= 0) return [];
        var tenantId = tenantContext.TenantId;
        if (dbContext.Database.IsRelational() && dbContext.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Employee Number allocation must run inside the workforce write transaction.");

        if (dbContext.Database.IsNpgsql())
        {
            var key = BitConverter.ToInt64(tenantId.ToByteArray(), 0) ^ LockNamespace;
            await dbContext.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})", cancellationToken);
        }

        var allocator = dbContext.EmployeeNumberAllocators.Local.SingleOrDefault(x => x.TenantId == tenantId)
            ?? await dbContext.EmployeeNumberAllocators.SingleOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (allocator is null)
        {
            allocator = EmployeeNumberAllocator.Create(tenantId);
            dbContext.EmployeeNumberAllocators.Add(allocator);
        }

        // Preload existing numbers once (bounded to a candidate window is unnecessary — the set is
        // the tenant's numbers, already indexed) plus the caller's manual reservations.
        var existing = await dbContext.Employees.AsNoTracking().Select(e => e.EmployeeNumber).ToListAsync(cancellationToken);
        var taken = new HashSet<string>(existing, StringComparer.Ordinal);
        taken.UnionWith(alreadyReserved);

        var reserved = new List<string>(count);
        while (reserved.Count < count)
        {
            var candidate = Format(allocator.TakeNext());
            if (taken.Add(candidate)) reserved.Add(candidate);
        }
        return reserved;
    }

    internal static string Format(long value) => $"{Prefix}{value.ToString($"D{Digits}")}";
}
