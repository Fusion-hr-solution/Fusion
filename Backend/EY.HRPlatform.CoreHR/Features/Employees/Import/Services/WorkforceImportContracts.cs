using EY.HRPlatform.CoreHR.Infrastructure.Imports;
namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public sealed record WorkforceImportIntakeRequest(
    Guid CreationToken,
    DateOnly BaselineDate,
    Stream File,
    string FileName,
    string? ContentType,
    string? SelectedSheetName,
    ImportActor Actor);

public enum WorkforceImportIntakeKind
{
    Ready,
    SheetSelectionRequired,
    HeaderClarificationRequired,
    Conflict,
}

public sealed record WorkforceImportSheetChoice(
    string FileName,
    string Format,
    long ByteLength,
    string Sha256,
    IReadOnlyList<WorkforceImportSheetSummary> Sheets);

public sealed record WorkforceImportIntakeOutcome(
    WorkforceImportIntakeKind Kind,
    bool Replayed,
    WorkforceImportSession? Session,
    WorkforceImportSheetChoice? SheetChoice,
    string? ConflictReason,
    IReadOnlyList<WorkforceHeaderCandidate>? HeaderCandidates = null);

public sealed class WorkforceImportNotFoundException(Guid sessionId)
    : Exception($"Workforce Import session {sessionId} was not found.")
{
    public Guid SessionId { get; } = sessionId;
}

public sealed class WorkforceImportConcurrencyException(Guid sessionId)
    : Exception($"Workforce Import session {sessionId} was changed elsewhere.")
{
    public Guid SessionId { get; } = sessionId;
}
