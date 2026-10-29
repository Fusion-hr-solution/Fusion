using System.Collections.Concurrent;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace EY.HRPlatform.SharedKernel.Notifications;

// The live nudge (B-002 N9): a module tells a signed-in person "your feed changed" the moment a notification for them
// commits or is read, and the shell refetches through the normal authorized endpoints. The signal carries ids only,
// never content, so it needs no authorization of its own beyond knowing who is listening.

/// <summary>A row whose insert or change means its recipient's feed changed (an in-app notification).</summary>
public interface IFeedNudgeRecipient
{
    Guid TenantId { get; }
    Guid? RecipientEmployeeId { get; }
    Guid? RecipientUserId { get; }
}

/// <summary>Whose feed: a tenant plus the employee record and/or account a notification can be addressed to.</summary>
public sealed record FeedRecipient(Guid TenantId, Guid? EmployeeId, Guid? UserId)
{
    public string ToPayload() => $"{TenantId:N}|{EmployeeId:N}|{UserId:N}";

    public static FeedRecipient? FromPayload(string? payload)
    {
        var parts = payload?.Split('|');
        if (parts is not { Length: 3 } || !Guid.TryParseExact(parts[0], "N", out var tenant) || tenant == Guid.Empty) return null;
        Guid? Optional(string value) => Guid.TryParseExact(value, "N", out var id) && id != Guid.Empty ? id : null;
        return new FeedRecipient(tenant, Optional(parts[1]), Optional(parts[2]));
    }

    public bool Matches(FeedRecipient other) => TenantId == other.TenantId
        && ((EmployeeId is Guid e && e == other.EmployeeId) || (UserId is Guid u && u == other.UserId));
}

public sealed partial class FeedNudgeOptions
{
    public FeedNudgeOptions(string channel, string connectionString)
    {
        if (!ChannelName().IsMatch(channel)) throw new ArgumentException("A nudge channel is a lowercase identifier.", nameof(channel));
        Channel = channel;
        ConnectionString = connectionString;
    }

    /// <summary>The PostgreSQL channel, one per module (<c>performance_feed</c>).</summary>
    public string Channel { get; }
    public string ConnectionString { get; }

    [GeneratedRegex("^[a-z][a-z0-9_]{0,62}$")]
    private static partial Regex ChannelName();
}

/// <summary>The open streams of this service instance, and who each one is listening for.</summary>
public sealed class FeedNudgeHub
{
    /// <summary>Tabs a person may hold open at once on one instance; more get a refusal and fall back to polling.</summary>
    public const int MaxStreamsPerRecipient = 10;

    private readonly ConcurrentDictionary<Guid, (FeedRecipient Recipient, Channel<bool> Changes)> _streams = new();
    private readonly object _gate = new();

    public sealed class Subscription(FeedNudgeHub hub, Guid id, ChannelReader<bool> changes) : IDisposable
    {
        public ChannelReader<bool> Changes { get; } = changes;
        public void Dispose() => hub._streams.TryRemove(id, out _);
    }

    public int Count => _streams.Count;

    /// <summary>Null when the person already has <see cref="MaxStreamsPerRecipient"/> streams open here.</summary>
    public Subscription? Subscribe(FeedRecipient recipient)
    {
        lock (_gate)
        {
            if (_streams.Values.Count(stream => stream.Recipient == recipient) >= MaxStreamsPerRecipient) return null;
            // One pending signal is enough: several changes before the next write become one refetch.
            var changes = Channel.CreateBounded<bool>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });
            var id = Guid.NewGuid();
            _streams[id] = (recipient, changes);
            return new Subscription(this, id, changes.Reader);
        }
    }

    public void Publish(FeedRecipient changed)
    {
        foreach (var stream in _streams.Values)
            if (stream.Recipient.Matches(changed)) stream.Changes.Writer.TryWrite(true);
    }

    /// <summary>After the listener lost its connection: nobody knows what they missed, so everyone refetches once.</summary>
    public void PublishAll()
    {
        foreach (var stream in _streams.Values) stream.Changes.Writer.TryWrite(true);
    }
}

/// <summary>
/// After a save that added or changed a <see cref="IFeedNudgeRecipient"/> row, queues <c>pg_notify</c> on the same
/// connection. Inside a transaction PostgreSQL delivers it on commit and drops it on rollback; otherwise the save has
/// already committed. Other providers (the in-memory test store) are left alone.
/// </summary>
public sealed class FeedNudgeInterceptor(FeedNudgeOptions options) : SaveChangesInterceptor
{
    private const string Npgsql = "Npgsql.EntityFrameworkCore.PostgreSQL";
    private readonly List<string> _pending = [];

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Collect(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Collect(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        foreach (var payload in Drain(eventData.Context))
            eventData.Context!.Database.ExecuteSql($"SELECT pg_notify({options.Channel}, {payload})");
        return result;
    }

    public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        foreach (var payload in Drain(eventData.Context))
            await eventData.Context!.Database.ExecuteSqlAsync($"SELECT pg_notify({options.Channel}, {payload})", cancellationToken);
        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => _pending.Clear();

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _pending.Clear();
        return Task.CompletedTask;
    }

    private void Collect(DbContext? context)
    {
        _pending.Clear();
        if (context is null || context.Database.ProviderName != Npgsql) return;
        _pending.AddRange(context.ChangeTracker.Entries<IFeedNudgeRecipient>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified)
            .Select(entry => new FeedRecipient(entry.Entity.TenantId, entry.Entity.RecipientEmployeeId, entry.Entity.RecipientUserId).ToPayload())
            .Distinct());
    }

    private List<string> Drain(DbContext? context)
    {
        var payloads = context is null ? [] : _pending.ToList();
        _pending.Clear();
        return payloads;
    }
}

/// <summary>Holds one <c>LISTEN</c> connection per service instance and hands each nudge to the hub.</summary>
public sealed class FeedNudgeListener(FeedNudgeOptions options, FeedNudgeHub hub, ILogger<FeedNudgeListener> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var connectionString = new NpgsqlConnectionStringBuilder(options.ConnectionString) { Pooling = false, KeepAlive = 30 }.ConnectionString;
        var reconnecting = false;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync(stoppingToken);
                connection.Notification += (_, e) =>
                {
                    if (FeedRecipient.FromPayload(e.Payload) is { } recipient) hub.Publish(recipient);
                };
                await using (var listen = new NpgsqlCommand($"LISTEN {options.Channel}", connection))
                    await listen.ExecuteNonQueryAsync(stoppingToken);
                if (reconnecting) hub.PublishAll();
                reconnecting = true;
                while (!stoppingToken.IsCancellationRequested) await connection.WaitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning("Feed nudge listener lost its connection ({ErrorType}); retrying.", ex.GetType().Name);
                try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }
    }
}

/// <summary>Writes the nudge stream: <c>ready</c> on connect, <c>changed</c> per nudge, a comment every 25 s.</summary>
public static class FeedNudgeStream
{
    public static readonly TimeSpan Heartbeat = TimeSpan.FromSeconds(25);
    /// <summary>The longest a stream stays open; the client reconnects with a fresh token.</summary>
    public static readonly TimeSpan MaxLifetime = TimeSpan.FromHours(1);

    /// <summary>
    /// Streams until the client leaves or <paramref name="endsAt"/> (the token's expiry) passes, so a stream never
    /// outlives the credential that opened it.
    /// </summary>
    public static async Task RunAsync(HttpContext http, FeedNudgeHub.Subscription subscription, DateTimeOffset? endsAt,
        TimeProvider clock, CancellationToken cancellationToken)
    {
        var response = http.Response;
        response.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache, no-transform";
        response.Headers["X-Accel-Buffering"] = "no";
        http.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        var lifetime = (endsAt ?? clock.GetUtcNow() + MaxLifetime) - clock.GetUtcNow();
        if (lifetime > MaxLifetime) lifetime = MaxLifetime;
        if (lifetime <= TimeSpan.Zero) return;
        using var open = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        open.CancelAfter(lifetime);
        try
        {
            await WriteAsync(response, "retry: 5000\nevent: ready\ndata: {}\n\n", open.Token);
            while (!open.IsCancellationRequested)
            {
                using var beat = CancellationTokenSource.CreateLinkedTokenSource(open.Token);
                beat.CancelAfter(Heartbeat);
                try
                {
                    await subscription.Changes.WaitToReadAsync(beat.Token);
                    while (subscription.Changes.TryRead(out _)) { }
                    await WriteAsync(response, "event: changed\ndata: {}\n\n", open.Token);
                }
                catch (OperationCanceledException) when (!open.IsCancellationRequested)
                {
                    await WriteAsync(response, ": ping\n\n", open.Token);
                }
            }
        }
        catch (OperationCanceledException) { }
    }

    private static async Task WriteAsync(HttpResponse response, string frame, CancellationToken cancellationToken)
    {
        await response.Body.WriteAsync(Encoding.UTF8.GetBytes(frame), cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}

public static class FeedNudgeServiceCollectionExtensions
{
    /// <summary>The live nudge for one module: hub, listener and the save interceptor (add it to the DbContext).</summary>
    public static IServiceCollection AddFeedNudges(this IServiceCollection services, string channel, string connectionString)
    {
        services.AddSingleton(new FeedNudgeOptions(channel, connectionString));
        services.AddSingleton<FeedNudgeHub>();
        services.AddScoped<FeedNudgeInterceptor>();
        services.AddHostedService<FeedNudgeListener>();
        return services;
    }
}
