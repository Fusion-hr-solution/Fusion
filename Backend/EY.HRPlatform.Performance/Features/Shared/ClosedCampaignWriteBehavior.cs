using System.Reflection;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;

namespace EY.HRPlatform.Performance.Features.Shared;

/// <summary>
/// Rejects every <see cref="ICampaignScopedCommand"/> aimed at a closed campaign, before the handler
/// runs (design D2).
/// </summary>
/// <remarks>
/// A pipeline gate rather than ~40 per-handler status checks, for the reason the audit already
/// demonstrated twice: a guarantee that depends on a developer remembering a line is a guarantee
/// that eventually lapses with no compiler error and no failing test. Commands that reach their
/// campaign indirectly implement <see cref="IGuardedCampaignCommand"/> and call
/// <see cref="CampaignWriteGuard"/> themselves; <c>ClosedCampaignGuardCoverageTests</c> asserts every
/// command is covered one way or the other, or explicitly exempt.
/// </remarks>
public sealed class ClosedCampaignWriteBehavior<TRequest, TResponse>(
    CampaignWriteGuard guard,
    ILogger<ClosedCampaignWriteBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private static readonly MethodInfo? FailureFactory = ResolveFailureFactory();

    /// <summary>
    /// Resolved once per closed request type: queries and non-campaign commands skip the guard
    /// entirely rather than paying a reflection cost per invocation.
    /// </summary>
    private static readonly bool IsCampaignScopedCommand =
        typeof(SharedKernel.CQRS.ICommand).IsAssignableFrom(typeof(TRequest))
            || typeof(TRequest).GetInterfaces().Any(contract =>
                contract.IsGenericType
                && contract.GetGenericTypeDefinition() == typeof(SharedKernel.CQRS.ICommand<>));

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!IsCampaignScopedCommand
            || typeof(TRequest).GetCustomAttribute<ClosedCampaignExemptAttribute>() is not null)
        {
            return await next(cancellationToken);
        }

        var scope = CampaignScopeResolver.Resolve(request);
        if (scope is null || !await guard.IsClosedForScopeAsync(scope, cancellationToken))
        {
            return await next(cancellationToken);
        }

        logger.LogInformation(
            "Rejected {RequestType} against a closed campaign, resolved via {ScopeKind} {ScopeId}.",
            typeof(TRequest).Name,
            scope.Kind,
            scope.Id);

        if (typeof(TResponse) == typeof(Result))
        {
            return (TResponse)(object)Result.Failure(CampaignClosureErrors.CampaignClosed());
        }

        if (FailureFactory is not null)
        {
            return (TResponse)FailureFactory.Invoke(null, [CampaignClosureErrors.CampaignClosed()])!;
        }

        // A command whose response cannot carry a failure must not silently proceed.
        throw new DomainRuleViolationException(CampaignClosureErrors.CampaignClosed().Message);
    }

    private static MethodInfo? ResolveFailureFactory()
    {
        var responseType = typeof(TResponse);
        if (!responseType.IsGenericType || responseType.GetGenericTypeDefinition() != typeof(Result<>))
        {
            return null;
        }

        return typeof(Result)
            .GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Single(method => method is { Name: nameof(Result.Failure), IsGenericMethodDefinition: true })
            .MakeGenericMethod(responseType.GetGenericArguments()[0]);
    }
}
