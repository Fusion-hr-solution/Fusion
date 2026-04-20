namespace EY.HRPlatform.CoreHR.Exceptions;

public sealed class InvalidTenantSetupStateException : Exception
{
    public InvalidTenantSetupStateException(string message)
        : base(message)
    {
    }
}