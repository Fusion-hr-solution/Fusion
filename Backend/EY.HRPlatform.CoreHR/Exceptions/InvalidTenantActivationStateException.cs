namespace EY.HRPlatform.CoreHR.Exceptions;

/// <summary>
/// Thrown when tenant setup cannot be activated because the tenant is not in a valid platform state.
/// Maps to HTTP 409 Conflict.
/// </summary>
public sealed class InvalidTenantActivationStateException : Exception
{
    public InvalidTenantActivationStateException(string message)
        : base(message)
    {
    }
}