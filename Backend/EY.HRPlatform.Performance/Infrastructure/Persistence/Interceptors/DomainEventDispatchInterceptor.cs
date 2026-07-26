using EY.HRPlatform.SharedKernel.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Activates the dormant <see cref="AggregateRoot"/> domain-event scaffold: after a unit of work
/// is successfully persisted, pending events are collected from tracked aggregates, cleared, then
/// published to in-process MediatR handlers.
///
/// Dispatch happens post-commit (<c>SavedChanges</c>), so side effects are decoupled from the
/// business transaction — a handler failure is logged and does not roll back the committed change
/// (best-effort, at-least-once; handlers must be duplicate-tolerant). Events are collected and
/// cleared before publishing, so a handler that saves again (activity/notification writes) does not
/// cause the same event to dispatch twice.
/// </summary>
public sealed class DomainEventDispatchInterceptor(
    IPublisher publisher,
    ILogger<DomainEventDispatchInterceptor> logger) : SaveChangesInterceptor
{
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        DispatchAsync(eventData.Context, CancellationToken.None).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await DispatchAsync(eventData.Context, cancellationToken);
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    private async Task DispatchAsync(DbContext? context, CancellationToken cancellationToken)
    {
        if (context is null)
        {
            return;
        }

        var aggregates = context.ChangeTracker
            .Entries<AggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .Select(e => e.Entity)
            .ToList();

        if (aggregates.Count == 0)
        {
            return;
        }

        var events = aggregates.SelectMany(a => a.DomainEvents).ToList();

        // Clear before publishing so a re-entrant SaveChanges from a handler does not re-dispatch.
        foreach (var aggregate in aggregates)
        {
            aggregate.ClearDomainEvents();
        }

        foreach (var domainEvent in events)
        {
            try
            {
                await publisher.Publish(domainEvent, cancellationToken);
            }
            catch (Exception ex)
            {
                // Post-commit: never surface a handler failure as a save failure or roll back.
                logger.LogError(
                    ex,
                    "Domain-event handler failed for {EventType} (event {EventId}); committed state is unaffected.",
                    domainEvent.GetType().Name,
                    domainEvent.EventId);
            }
        }
    }
}
