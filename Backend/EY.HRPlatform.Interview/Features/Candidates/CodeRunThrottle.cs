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

    // All four steps (prune stale, capacity check, min-interval, per-minute cap, reserve) run in
    // ONE Lua script so they're atomic: the capacity check and the slot reservation can't race
    // (two requests can no longer both pass the check and then both reserve, briefly exceeding the
    // budget). The ordering is preserved — capacity is checked before the interval/quota are
    // consumed, so a "busy" rejection doesn't burn the candidate's per-attempt rate allowance.
    // Returns: 0 = acquired, 1 = busy, 2 = too quick (interval), 3 = too many (per-minute).
    private const string AcquireLua = @"
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 1 end
if tonumber(ARGV[5]) > 0 then
  if redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[5]) == false then return 2 end
end
if tonumber(ARGV[6]) > 0 then
  local c = redis.call('INCR', KEYS[3])
  if c == 1 then redis.call('EXPIRE', KEYS[3], 60) end
  if c > tonumber(ARGV[6]) then return 3 end
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
return 0";

    private async Task<IAsyncDisposable> AcquireRedisAsync(Guid attemptId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var db = _redis!.GetDatabase();

        // A sorted set scored by start time is self-healing: stale entries (from crashed requests
        // that never released) age out by score, so the budget can't be permanently leaked.
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var member = Guid.NewGuid().ToString("N");

        var keys = new RedisKey[]
        {
            InflightKey,
            $"coderun:iv:{attemptId}",
            $"coderun:cnt:{attemptId}",
        };
        var values = new RedisValue[]
        {
            nowMs - _maxRunMs,   // ARGV[1] stale cutoff
            nowMs,               // ARGV[2] this run's score
            _maxConcurrent,      // ARGV[3]
            member,              // ARGV[4]
            _minIntervalSeconds, // ARGV[5]
            _maxRunsPerMinute,   // ARGV[6]
        };

        var outcome = (long)await db.ScriptEvaluateAsync(AcquireLua, keys, values);
        switch (outcome)
        {
            case 1:
                throw TooManyRequests("Code execution is busy right now — try again in a few seconds.");
            case 2:
                throw TooManyRequests("You're running too quickly — wait a moment and try again.");
            case 3:
                throw TooManyRequests("Too many runs in a short time — try again shortly.");
            default:
                return new RedisSlot(db, member);
        }
    }

    private IAsyncDisposable AcquireInProcess(Guid attemptId)
    {
        // Capacity first, so a busy-system rejection doesn't consume the per-attempt interval.
        if (!_localGate.Wait(0))
            throw TooManyRequests("Code execution is busy right now — try again in a few seconds.");

        try
        {
            if (_minIntervalSeconds > 0)
            {
                var now = DateTime.UtcNow;
                if (_localLastRun.TryGetValue(attemptId, out var last) &&
                    now - last < TimeSpan.FromSeconds(_minIntervalSeconds))
                {
                    throw TooManyRequests("You're running too quickly — wait a moment and try again.");
                }
                _localLastRun[attemptId] = now;
                PruneLocalLastRun(now);
            }
        }
        catch
        {
            _localGate.Release();
            throw;
        }

        return new ActionSlot(() => _localGate.Release());
    }

    // Bound the fallback dictionary so it can't grow without limit on a long-lived server
    // (only used when Redis is absent). Drops entries older than the interval window.
    private void PruneLocalLastRun(DateTime now)
    {
        if (_localLastRun.Count <= 1024)
            return;
        var cutoff = now - TimeSpan.FromSeconds(Math.Max(_minIntervalSeconds, 60));
        foreach (var entry in _localLastRun)
        {
            if (entry.Value < cutoff)
                _localLastRun.TryRemove(entry.Key, out _);
        }
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
