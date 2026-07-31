namespace EY.HRPlatform.CoreHR.Domain.Enums;

/// <summary>
/// Status of a canonical <c>Employment</c> record. An employee may have at most one
/// <see cref="Active"/> employment at a time; termination moves it to <see cref="Ended"/>
/// and rehire creates a new employment rather than reopening one.
/// </summary>
public enum EmploymentStatus
{
    Active,
    Ended
}
