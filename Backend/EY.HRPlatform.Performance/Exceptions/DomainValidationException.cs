namespace EY.HRPlatform.Performance.Exceptions;

/// <summary>
/// Deliberate validation of caller input that failed — a value the user can correct.
/// </summary>
/// <remarks>
/// Exists so intentional validation stops sharing a type with internal faults (design D8). The
/// module previously threw <see cref="ArgumentException"/> for both, and because
/// <see cref="ArgumentNullException"/> and <see cref="ArgumentOutOfRangeException"/> derive from it,
/// an internal defect surfaced to the client as a 400 carrying an internal parameter name.
/// </remarks>
public sealed class DomainValidationException(string message, string? code = null, string? field = null)
    : Exception(message)
{
    /// <summary>Machine-readable code so the client branches on outcome, not on message text.</summary>
    public string Code { get; } = code ?? "Performance.Validation";

    /// <summary>The input that failed, when the failure is attributable to one.</summary>
    public string? Field { get; } = field;
}
