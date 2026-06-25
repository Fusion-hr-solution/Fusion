namespace EY.HRPlatform.Performance.Exceptions;

/// <summary>
/// Thrown when an operation violates a domain rule that represents an invalid state
/// transition or business invariant (e.g. publishing a cycle with no population).
/// Maps to HTTP 409 Conflict.
/// </summary>
public sealed class DomainRuleViolationException : Exception
{
    public DomainRuleViolationException(string message) : base(message)
    {
    }
}
