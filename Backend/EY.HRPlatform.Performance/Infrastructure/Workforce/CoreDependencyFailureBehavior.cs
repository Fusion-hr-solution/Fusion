using System.Reflection;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;

namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// Translates a Core HR outage into a recoverable failure result for every command and query in
/// the module, instead of letting it surface as an internal fault or — worse — as a partial
/// result computed from an incomplete workforce read.
/// </summary>
/// <remarks>
/// This is a pipeline gate rather than a per-handler <c>catch</c> for the same reason the
/// closed-campaign guard is: a handler added later must not be able to silently escape it. Because
/// the exception propagates out of the handler, nothing it had staged is saved — a launch that
/// loses Core HR mid-resolution aborts without freezing a participant baseline.
/// </remarks>
public sealed class CoreDependencyFailureBehavior<TRequest, TResponse>(
    ILogger<CoreDependencyFailureBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    /// <summary>
    /// Closed over <typeparamref name="TResponse"/>, so this resolves once per response type
    /// rather than once per request.
    /// </summary>
    private static readonly MethodInfo? FailureFactory = ResolveFailureFactory();

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        try
        {
            return await next(cancellationToken);
        }
        catch (CoreWorkforceUnavailableException exception)
        {
            logger.LogWarning(
                exception,
                "Core HR was unavailable while handling {RequestType}; returning a recoverable failure.",
                typeof(TRequest).Name);

            if (typeof(TResponse) == typeof(Result))
            {
                return (TResponse)(object)Result.Failure(exception.ToError());
            }

            if (FailureFactory is not null)
            {
                return (TResponse)FailureFactory.Invoke(null, [exception.ToError()])!;
            }

            // A response type that cannot carry a failure: the exception middleware classifies it.
            throw;
        }
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
