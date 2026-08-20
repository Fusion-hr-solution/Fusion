using System.Text.Json;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>Product-facing suggestion: which allowed Fusion field an unresolved source column likely means.</summary>
public sealed record WorkforceSemanticSuggestionDto(int ColumnIndex, string? SourceLabel, string TargetField, string TargetDisplayName, string? Rationale);

public sealed record WorkforceSemanticSuggestionsDto(bool Available, string? Reason, IReadOnlyList<WorkforceSemanticSuggestionDto> Suggestions);

/// <summary>
/// The optional "Suggest meanings" action. Deterministic interpretation runs first; this only
/// proposes meanings for columns still unresolved, sends a PII-minimized payload, and never mutates
/// canonical workforce — applying a suggestion is a separate ETag-protected mapping decision. When
/// the provider is unavailable/fails, manual interpretation stays fully usable (Available=false).
/// No provider/model identity is exposed.
/// </summary>
public sealed class WorkforceImportSemanticService(
    CoreHRDbContext context,
    ITenantContext tenant,
    WorkforceImportInterpreter interpreter,
    WorkforceImportSemanticContextBuilder contextBuilder,
    IWorkforceImportSemanticProvider provider)
{
    public async Task<WorkforceSemanticSuggestionsDto> SuggestAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await context.WorkforceImportSessions.Include(s => s.Source)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);

        if (!provider.IsConfigured)
            return new WorkforceSemanticSuggestionsDto(false, "Suggestions aren't available right now. You can continue manually.", []);

        var columns = Deserialize(session.Source.ColumnsJson) ?? [];
        var rows = await context.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId).OrderBy(r => r.SourceRowNumber)
            .Select(r => r.SourceCellsJson).ToListAsync(cancellationToken);
        var cells = rows.Select(json => (IReadOnlyList<string?>)(Deserialize(json) ?? [])).ToList();

        // Only columns still unresolved after deterministic interpretation are eligible.
        var doc = WorkforceImportDecisionDoc.Parse(session.DecisionsJson);
        var interpretation = interpreter.Interpret(columns, cells, doc.ToInterpretation(), session.BaselineDate);
        var unresolved = interpretation.Mappings.Where(m => m.Origin == "unresolved").Select(m => m.ColumnIndex).ToList();
        if (unresolved.Count == 0)
            return new WorkforceSemanticSuggestionsDto(true, null, []);

        var request = contextBuilder.Build(columns, cells, unresolved, WorkforceSemanticTargets.All);
        try
        {
            var result = await provider.SuggestAsync(request, cancellationToken);
            var targetsByKey = WorkforceSemanticTargets.All.ToDictionary(t => t.Key);
            var suggestions = result.Suggestions
                .Where(s => targetsByKey.ContainsKey(s.TargetKey))
                .Select(s => new WorkforceSemanticSuggestionDto(
                    s.ColumnIndex, s.ColumnIndex < columns.Count ? columns[s.ColumnIndex] : null,
                    s.TargetKey, targetsByKey[s.TargetKey].DisplayName, s.Rationale))
                .ToList();
            return new WorkforceSemanticSuggestionsDto(true, null, suggestions);
        }
        catch (WorkforceImportSemanticProviderException)
        {
            // Provider failure never blocks manual interpretation.
            return new WorkforceSemanticSuggestionsDto(false, "Suggestions aren't available right now. You can continue manually.", []);
        }
    }

    private static List<string?>? Deserialize(string? json)
        => json is null ? null : JsonSerializer.Deserialize<List<string?>>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));
}
