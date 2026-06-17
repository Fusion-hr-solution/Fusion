using System.Collections.Concurrent;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Http;
using StackExchange.Redis;

namespace EY.HRPlatform.Interview.Features.Candidates;

/// <summary>
/// Backpressure + rate limiting for the candidate "run code" endpoint. Coordinates across
/// API replicas via Redis (the interview API may be scaled out), with an in-process fallback
/// when Redis isn't configured or is briefly unavailable. Throws <see cref="ApiException"/>
/// with 429 when a limit is hit; the returned handle must be disposed to release the slot.
/// </summary>
public interface ICodeRunThrottle
{
    Task<IAsyncDisposable> AcquireAsync(Guid attemptId, CancellationToken cancellationToken);
}

public sealed class CodeRunThrottle : ICodeRunThrottle
{
    private const string InflightKey = "coderun:inflight";

    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<CodeRunThrottle> _logger;

    private readonly int _maxConcurrent;
    private readonly int _minIntervalSeconds;
    private readonly int _maxRunsPerMinute;
    private readonly long _maxRunMs;

    // In-process fallback state (used only when Redis is absent/unreachable).
    private readonly SemaphoreSlim _localGate;
    private readonly ConcurrentDictionary<Guid, DateTime> _localLastRun = new();

    public CodeRunThrottle(IConfiguration configuration, ILogger<CodeRunThrottle> logger, IConnectionMultiplexer? redis = null)
    {
        _redis = redis;
        _logger = logger;
        _maxConcurrent = configuration.GetValue("CodeRun:MaxConcurrent", 8);
        _minIntervalSeconds = configuration.GetValue("CodeRun:MinIntervalSeconds", 2);
        _maxRunsPerMinute = configuration.GetValue("CodeRun:MaxRunsPerMinute", 20);
        _maxRunMs = configuration.GetValue("CodeRun:MaxRunSeconds", 35) * 1000L;
        _localGate = new SemaphoreSlim(Math.Max(1, _maxConcurrent), Math.Max(1, _maxConcurrent));
    }

    public async Task<IAsyncDisposable> AcquireAsync(Guid attemptId, CancellationToken cancellationToken)
    {
        if (_redis is not null)
        {
            try
            {
                return await AcquireRedisAsync(attemptId, cancellationToken);
            }
            catch (ApiException)
            {
                throw; // intentional 429 — never fall through to the fallback
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis run-throttle unavailable; using in-process fallback.");
            }
        }

        return AcquireInProcess(attemptId);
    }

    private async Task<IAsyncDisposable> AcquireRedisAsync(Guid attemptId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var db = _redis!.GetDatabase();

        // 1) Minimum interval between runs for this attempt.
        if (_minIntervalSeconds > 0)
        {
            var fresh = await db.StringSetAsync(
                $"coderun:iv:{attemptId}", "1", TimeSpan.FromSeconds(_minIntervalSeconds), When.NotExists);
            if (!fresh)
                throw TooManyRequests("You're running too quickly — wait a moment and try again.");
        }

        // 2) Per-attempt runs-per-minute cap.
        if (_maxRunsPerMinute > 0)
        {
            var countKey = $"coderun:cnt:{attemptId}";
            var count = await db.StringIncrementAsync(countKey);
            if (count == 1)
                await db.KeyExpireAsync(countKey, TimeSpan.FromMinutes(1));
            if (count > _maxRunsPerMinute)
                throw TooManyRequests("Too many runs in a short time — try again shortly.");
        }

        // 3) Global concurrency budget. A sorted set scored by start time is self-healing:
        // stale entries (from crashed requests that never released) age out by score, so the
        // budget can't be permanently leaked.
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await db.SortedSetRemoveRangeByScoreAsync(InflightKey, double.NegativeInfinity, nowMs - _maxRunMs);
        var inflight = await db.SortedSetLengthAsync(InflightKey);
        if (inflight >= _maxConcurrent)
            throw TooManyRequests("Code execution is busy right now — try again in a few seconds.");

        var member = Guid.NewGuid().ToString("N");
        await db.SortedSetAddAsync(InflightKey, member, nowMs);
        return new RedisSlot(db, member);
    }

    private IAsyncDisposable AcquireInProcess(Guid attemptId)
    {
        if (_minIntervalSeconds > 0)
        {
            var now = DateTime.UtcNow;
            var last = _localLastRun.GetOrAdd(attemptId, DateTime.MinValue);
            if (now - last < TimeSpan.FromSeconds(_minIntervalSeconds))
                throw TooManyRequests("You're running too quickly — wait a moment and try again.");
            _localLastRun[attemptId] = now;
        }

        if (!_localGate.Wait(0))
            throw TooManyRequests("Code execution is busy right now — try again in a few seconds.");

        return new ActionSlot(() => _localGate.Release());
    }

    private static ApiException TooManyRequests(string message) =>
        new(message, StatusCodes.Status429TooManyRequests);

    private sealed class RedisSlot(IDatabase db, string member) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try
            {
                await db.SortedSetRemoveAsync(InflightKey, member);
            }
            catch
            {
                // Best effort — a leaked entry ages out of the sorted set by score.
            }
        }
    }

    private sealed class ActionSlot(Action release) : IAsyncDisposable
    {
        private int _disposed;

        public ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 0)
                release();
            return ValueTask.CompletedTask;
        }
    }
}
