using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The employee's single, immutable clarification on a Completed check-in. It never reopens the
/// check-in, alters the manager's summary, or requires approval, and cannot be edited or removed.
/// </summary>
public sealed class PerformanceCheckInResponse : BaseEntity
{
    public const int TextMaxLength = 2000;

    private PerformanceCheckInResponse() { }

    public Guid CheckInId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }

    internal static PerformanceCheckInResponse Create(
        Guid checkInId,
        Guid employeeId,
        string text,
        DateTime createdAtUtc)
        => new()
        {
            Id = Guid.NewGuid(),
            CheckInId = checkInId,
            EmployeeId = employeeId,
            Text = (text ?? string.Empty).Trim(),
            CreatedAtUtc = createdAtUtc
        };
}
