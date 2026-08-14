using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public sealed record OrganizationSourceColumn(int Index, string? SourceLabel);
public sealed record OrganizationSourceTable(
    IReadOnlyList<OrganizationSourceColumn> Columns,
    IReadOnlyList<IReadOnlyList<string?>> Rows);

public sealed record InspectedOrganizationSource(
    string OriginalFileName,
    string SourceFormat,
    string ContentType,
    string Sha256,
    string SelectedSheetName,
    string SelectedRange,
    OrganizationSourceTable Table,
    byte[] RawBytes);

public sealed record OrganizationSourceChoice(
    string OriginalFileName,
    string SourceFormat,
    long ByteLength,
    string Sha256,
    IReadOnlyList<string> CandidateSheetNames);

public abstract record OrganizationSourceInspection;
public sealed record OrganizationSourceReady(InspectedOrganizationSource Source) : OrganizationSourceInspection;
public sealed record OrganizationSheetSelectionRequired(OrganizationSourceChoice Choice) : OrganizationSourceInspection;

public sealed record CanonicalOrganizationBaselineSummary(
    bool HasPermanentRootIdentity,
    bool HasRootAsOfEffectiveDate);

public sealed record OrganizationImportSourceDto(
    string OriginalFileName,
    string SourceFormat,
    string ContentType,
    long ByteLength,
    string Sha256,
    string SelectedSheetName,
    string SelectedRange,
    int ColumnCount,
    int RowCount,
    DateTime? PayloadPurgedAt,
    OrganizationSourceTable? Table);

public sealed record OrganizationImportSessionDto(
    Guid Id,
    string Status,
    DateOnly EffectiveDate,
    uint Version,
    Guid StartedByUserId,
    string StartedByDisplayName,
    Guid LastUpdatedByUserId,
    string LastUpdatedByDisplayName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? DiscardedAt,
    OrganizationImportSourceDto Source,
    CanonicalOrganizationBaselineSummary Baseline,
    OrganizationImportDecisions Decisions,
    OrganizationImportReview? Review,
    OrganizationImportCommitResult? CommitResult,
    DateTime? CommittedAt,
    Guid? CommittedByUserId,
    string? CommittedByDisplayName,
    IReadOnlyList<OrganizationImportProvenance>? FinalProvenance);

public sealed record OrganizationImportActiveSummaryDto(
    Guid Id,
    DateOnly EffectiveDate,
    uint Version,
    string OriginalFileName,
    string SourceFormat,
    int RowCount,
    string StartedByDisplayName,
    string LastUpdatedByDisplayName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportIntakeKind
{
    SourceReady,
    SheetSelectionRequired,
}

public sealed record OrganizationImportIntakeResult(
    OrganizationImportIntakeKind Kind,
    bool Replayed,
    OrganizationImportSessionDto? Session,
    OrganizationSourceChoice? SheetSelection);

public sealed record UpdateOrganizationImportEffectiveDateRequest(DateOnly EffectiveDate);

public sealed class OrganizationImportSourceException(
    string code,
    string safeMessage,
    int statusCode = StatusCodes.Status422UnprocessableEntity) : Exception(safeMessage)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}

internal static class OrganizationImportJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static OrganizationSourceTable? Deserialize(string? value)
        => value is null ? null : JsonSerializer.Deserialize<OrganizationSourceTable>(value, Options);
    public static T? Deserialize<T>(string? value)
        => value is null ? default : JsonSerializer.Deserialize<T>(value, Options);
}
