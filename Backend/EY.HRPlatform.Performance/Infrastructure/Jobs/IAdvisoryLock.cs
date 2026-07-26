using System.Data;
using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// A best-effort, cross-process mutual-exclusion primitive used to guarantee single-run-under-
/// concurrency for a sweep. Acquisition is non-blocking: it either grants the lock or reports
/// contention immediately so the caller can skip the tick.
/// </summary>
public interface IAdvisoryLock
{
    /// <summary>
    /// Tries to acquire the named lock without blocking. Returns a handle to release on dispose,
    /// or null when another holder currently owns it.
    /// </summary>
    Task<IAsyncDisposable?> TryAcquireAsync(string key, CancellationToken cancellationToken);
}

/// <summary>
/// Postgres advisory-lock implementation using <c>pg_try_advisory_lock</c> on a dedicated
/// connection held for the duration of the job execution and released (<c>pg_advisory_unlock</c>)
/// on dispose. The lock is keyed by a stable 64-bit hash of the job name.
/// </summary>
public sealed class PostgresAdvisoryLock(IServiceProvider services) : IAdvisoryLock
{
    public async Task<IAsyncDisposable?> TryAcquireAsync(string key, CancellationToken cancellationToken)
    {
        var lockKey = ToLockKey(key);

        // Open a dedicated physical connection distinct from any scoped DbContext connection so the
        // session-level lock is held for the whole job, independent of per-tenant scopes.
        var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var connection = (NpgsqlConnection)db.Database.GetDbConnection();

        var openedHere = false;
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
            openedHere = true;
        }

        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT pg_try_advisory_lock(@key)";
        command.Parameters.Add(new NpgsqlParameter("key", lockKey));
        var acquired = (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);

        if (!acquired)
        {
            if (openedHere)
            {
                await connection.CloseAsync();
            }
            scope.Dispose();
            return null;
        }

        return new Handle(scope, connection, lockKey, openedHere);
    }

    private static long ToLockKey(string key)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        return BitConverter.ToInt64(bytes, 0);
    }

    private sealed class Handle(IServiceScope scope, NpgsqlConnection connection, long lockKey, bool ownsConnection)
        : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "SELECT pg_advisory_unlock(@key)";
                command.Parameters.Add(new NpgsqlParameter("key", lockKey));
                await command.ExecuteScalarAsync();
            }
            finally
            {
                if (ownsConnection && connection.State == ConnectionState.Open)
                {
                    await connection.CloseAsync();
                }
                scope.Dispose();
            }
        }
    }
}
