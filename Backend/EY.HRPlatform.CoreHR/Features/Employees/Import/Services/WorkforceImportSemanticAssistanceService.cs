using System.Text.RegularExpressions;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>Starts a run from Match: the first time (granting tenant consent) or after a retryable failure.</summary>
public sealed record RunWorkforceSemanticAssistanceRequest(string InputFingerprint, bool GrantTenantConsent = false);

/// <summary>
/// Semantic assistance for Workforce Import on the shared runner. Deterministic interpretation
/// runs first; only the column meanings and status values it could not settle become questions.
/// Validated answers are applied to the Mapping Plan with SemanticSuggestion origin and never over
/// an administrator decision. The model interprets meaning only: it never matches people, managers
/// or organization units, and a failure always leaves Match fully usable by hand.
/// </summary>
public sealed partial class WorkforceImportSemanticAssistanceService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    WorkforceImportDerivation derivation,
    WorkforceImportSemanticContextBuilder contextBuilder,
    IWorkforceImportSemanticProvider provider,
    WorkforceImportSemanticAssistanceOptions options,
    ILogger<WorkforceImportSemanticAssistanceService> logger,
    TimeProvider? timeProvider = null)
{
    private const string AttemptUniqueConstraint = "UX_WorkforceImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal";

    /// <summary>Fields assistance may propose. Fusion ID columns are trusted identity and only ever mapped deliberately.</summary>
    private static readonly WorkforceImportField[] SuggestableFields =
    [
        WorkforceImportField.EmployeeNumber, WorkforceImportField.FirstName, WorkforceImportField.LastName, WorkforceImportField.FullName,
        WorkforceImportField.PreferredName, WorkforceImportField.WorkEmail, WorkforceImportField.EmploymentStart,
        WorkforceImportField.WorkEffectiveFrom, WorkforceImportField.Organization, WorkforceImportField.DisplayTitle,
        WorkforceImportField.Location, WorkforceImportField.Manager, WorkforceImportField.WorkerReference,
        WorkforceImportField.ManagerReference, WorkforceImportField.LifecycleStatus, WorkforceImportField.EmploymentEnd,
    ];

    private readonly ImportSemanticRunner runner = new(
        dbContext,
        ImportSemanticBudget.From(options.UploadBudgetSeconds, options.InteractiveBudgetSeconds, options.TimeoutSeconds, options.MaxRetries),
        ImportSemanticTelemetry.Workforce,
        AttemptUniqueConstraint,
        logger,
        timeProvider);

    private bool Available => provider.IsConfigured;

    public async Task<ImportSemanticAssistanceDto> DescribeAsync(
        WorkforceImportSession session, WorkforceImportMatchState derived, CancellationToken cancellationToken)
    {
        var request = BuildRequest(session, derived);
        var latest = await ImportSemanticRunner.LatestAsync(dbContext.WorkforceImportSemanticAttempts, session.Id, cancellationToken);
        var hasConsent = latest is not null || request is null || !Available || await HasConsentAsync(session.Id, cancellationToken);
        return runner.Describe(
            latest,
            request?.InputFingerprint,
            request?.Questions.Select(q => q.Key).ToList(),
            false,
            Available,
            hasConsent,
            ImportSemanticConsentPolicy.ScopeOf(options.ConsentMode));
    }

    /// <summary>Runs assistance right after upload when needed and consented, inside the upload budget. Never throws.</summary>
    public async Task RunAfterUploadAsync(Guid sessionId, ImportActor actor, CancellationToken cancellationToken)
    {
        try
        {
            if (!Available) return;
            if (options.ConsentMode == ImportSemanticConsentMode.PerImport) return;
            var (session, derived) = await LoadAndDeriveAsync(sessionId, cancellationToken);
            if (!session.IsActive) return;
            var request = BuildRequest(session, derived);
            if (request is null)
            {
                ImportSemanticTelemetry.Workforce.RecordNotNeeded();
                return;
            }
            if (!await HasConsentAsync(sessionId, cancellationToken)) return;
            if (await dbContext.WorkforceImportSemanticAttempts.AnyAsync(a => a.SessionId == sessionId, cancellationToken)) return;
            await runner.RunAsync(dbContext.WorkforceImportSemanticAttempts,
                BuildRun(session, request, ImportSemanticTrigger.Upload, runner.UploadBudget, actor), cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // Upload success never depends on the provider: Match opens with the deterministic result.
            logger.LogWarning("Workforce import semantic assistance could not run after upload. ErrorType={ErrorType}", exception.GetType().Name);
        }
    }

    /// <summary>An administrator-started run from Match, optionally granting Workforce standing consent first.</summary>
    public async Task RunAsync(Guid sessionId, RunWorkforceSemanticAssistanceRequest runRequest, ImportActor actor, CancellationToken cancellationToken)
    {
        var (session, derived) = await LoadAndDeriveAsync(sessionId, cancellationToken);
        if (!session.IsActive || session.IsPublishing)
            throw new WorkforceImportReviewException("Only an import in progress can use automatic matching.", "ImportTerminal");
        var request = BuildRequest(session, derived)
            ?? throw new WorkforceImportReviewException("Nothing is left for automatic matching to help with.", "SemanticAssistanceNotNeeded");
        if (!ImportFingerprint.Matches(request.InputFingerprint, runRequest.InputFingerprint))
            throw new WorkforceImportReviewException("The import changed. Review the current mappings and try again.", "SemanticSuggestionsChanged");
        if (!Available)
            throw new WorkforceImportReviewException("Automatic matching isn't available. Finish the mappings manually.", "SemanticAssistanceUnavailable");

        if (!await HasConsentAsync(sessionId, cancellationToken))
        {
            if (!runRequest.GrantTenantConsent)
                throw new WorkforceImportReviewException("Automatic matching needs to be turned on first.", "SemanticConsentRequired");
            await ImportSemanticConsentPolicy.GrantAsync(
                dbContext, tenantContext.TenantId, options.ConsentMode, provider.ProviderName,
                WorkforceImportSemanticVersions.DataContract, actor, sessionId, cancellationToken);
            logger.LogInformation("Workforce import semantic consent granted. Provider={Provider} Mode={Mode}", provider.ProviderName, options.ConsentMode);
            (session, derived) = await LoadAndDeriveAsync(sessionId, cancellationToken);
        }

        var latest = await ImportSemanticRunner.LatestAsync(dbContext.WorkforceImportSemanticAttempts, sessionId, cancellationToken);
        if (!runner.ShouldStartInteractive(latest, request.Questions.Select(q => q.Key).ToList(), out var rateLimited))
        {
            if (rateLimited)
                throw new WorkforceImportReviewException("Automatic matching can be retried shortly. You can keep mapping manually.", "SemanticSuggestionsRateLimited");
            return;
        }
        await runner.RunAsync(dbContext.WorkforceImportSemanticAttempts,
            BuildRun(session, request, ImportSemanticTrigger.Administrator, runner.InteractiveBudget, actor), cancellationToken);
    }

    /// <summary>Counts administrator changes to meanings assistance supplied. Saved with the caller's own change.</summary>
    public async Task RecordOverridesAsync(Guid sessionId, int overriddenCount, CancellationToken cancellationToken)
    {
        if (overriddenCount <= 0) return;
        var attempt = await dbContext.WorkforceImportSemanticAttempts
            .Where(a => a.SessionId == sessionId && a.Status == ImportSemanticAttemptStatus.Succeeded && a.SuggestionsApplied > 0)
            .OrderByDescending(a => a.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);
        if (attempt is null) return;
        attempt.RecordOverrides(overriddenCount);
        ImportSemanticTelemetry.Workforce.RecordOverrides(attempt.Provider, attempt.Model, overriddenCount);
    }

    /// <summary>
    /// The open semantic questions: unresolved non-empty columns, and status values Fusion does not
    /// know. Null when there is nothing to ask. Only the columns asked about contribute evidence.
    /// </summary>
    internal WorkforceImportSemanticRequest? BuildRequest(WorkforceImportSession session, WorkforceImportMatchState derived)
    {
        var interpretation = derived.Interpretation;
        var mappedFields = interpretation.Mappings.Where(m => m.Field != WorkforceImportField.Ignored).Select(m => m.Field).ToHashSet();
        var openFields = SuggestableFields.Where(f => !mappedFields.Contains(f)).ToList();
        var fieldTargets = openFields.Select(f => new ImportSemanticTarget($"field:{f}", FieldLabel(f)))
            .Append(new ImportSemanticTarget("field:Ignored", "Not needed"))
            .ToList();

        var unresolvedColumns = interpretation.Mappings
            .Where(m => !m.Resolved && derived.Cells.Any(row => m.ColumnIndex < row.Count && !string.IsNullOrWhiteSpace(row[m.ColumnIndex])))
            .Select(m => m.ColumnIndex)
            .Take(options.MaxQuestions)
            .ToList();
        var questions = new List<ImportSemanticIssue>();
        foreach (var index in unresolvedColumns)
            questions.Add(new ImportSemanticIssue($"column:{index}", WorkforceImportSemanticKinds.FieldMapping, index,
                index < derived.Columns.Count ? derived.Columns[index] : null, fieldTargets));
        foreach (var value in interpretation.LifecycleValues.Where(v => v.Meaning is null).Take(options.MaxQuestions))
            questions.Add(new ImportSemanticIssue($"status:{value.NormalizedValue}", WorkforceImportSemanticKinds.LifecycleVocabulary, null,
                Sanitize(value.SourceValue),
                [new ImportSemanticTarget("lifecycle:Active", "Currently employed"), new ImportSemanticTarget("lifecycle:Former", "Has left")]));
        if (questions.Count == 0) return null;

        var columns = contextBuilder.BuildColumns(derived.Columns, derived.Cells, unresolvedColumns);
        var inputFingerprint = ImportFingerprint.HashCanonical(new
        {
            data = WorkforceImportSemanticVersions.DataContract,
            result = WorkforceImportSemanticVersions.ResultContract,
            questions = questions.Select(q => new { q.Key, targets = q.AllowedTargets.Select(t => t.Key), q.SourceLabel }),
            columns,
        });
        return new WorkforceImportSemanticRequest(WorkforceImportSemanticVersions.ResultContract, session.Source.Sha256, questions, columns, inputFingerprint);
    }

    private ImportSemanticRun<WorkforceImportSemanticAttempt> BuildRun(
        WorkforceImportSession session, WorkforceImportSemanticRequest request, ImportSemanticTrigger trigger, TimeSpan budget, ImportActor actor)
        => new(
            session.Id,
            request.InputFingerprint,
            request.Questions.Count,
            request.ResultContractVersion,
            WorkforceImportSemanticVersions.DataContract,
            WorkforceImportSemanticVersions.Prompt,
            provider.ProviderName,
            provider.ModelName,
            trigger,
            budget,
            ordinal => WorkforceImportSemanticAttempt.Start(
                tenantContext.TenantId, session.Id, ordinal, trigger, request.SourceFingerprint, request.InputFingerprint,
                request.ResultContractVersion, WorkforceImportSemanticVersions.DataContract, WorkforceImportSemanticVersions.Prompt,
                provider.ProviderName, provider.ModelName, request.Questions.Select(q => q.Key).ToList()),
            token => provider.SuggestAsync(request, token),
            (result, token) => ApplyToCurrentAsync(session.Id, request.InputFingerprint, result, actor, token));

    /// <summary>Validates answers against the import as it is now and applies what survives; null when the import changed.</summary>
    private async Task<ImportSemanticRunOutcome?> ApplyToCurrentAsync(
        Guid sessionId, string askedFingerprint, ImportSemanticProviderResult result, ImportActor actor, CancellationToken cancellationToken)
    {
        var (session, derived) = await LoadAndDeriveAsync(sessionId, cancellationToken, tracked: true);
        if (!session.IsActive || session.IsPublishing) return null;
        var request = BuildRequest(session, derived);
        if (request is null || !ImportFingerprint.Matches(request.InputFingerprint, askedFingerprint)) return null;

        var questions = request.Questions.ToDictionary(q => q.Key, StringComparer.Ordinal);
        var answered = new HashSet<string>(StringComparer.Ordinal);
        var claimed = new HashSet<string>(StringComparer.Ordinal);
        var plan = derived.Plan;
        var applied = new List<ImportAppliedSuggestion>();
        int returned = 0, rejected = 0, abstained = 0, accepted = 0;

        foreach (var answer in result.Answers)
        {
            if (!questions.TryGetValue(answer.QuestionKey, out var question) || !answered.Add(answer.QuestionKey))
            {
                if (answer.Disposition == ImportSemanticDisposition.Suggest) { returned++; rejected++; }
                continue;
            }
            if (answer.Disposition == ImportSemanticDisposition.Abstain || answer.TargetKey is null) { abstained++; continue; }
            returned++;
            if (question.AllowedTargets.All(t => t.Key != answer.TargetKey)) { rejected++; continue; }

            if (question.Kind == WorkforceImportSemanticKinds.FieldMapping && question.SourceColumnIndex is int column)
            {
                var field = Enum.Parse<WorkforceImportField>(answer.TargetKey["field:".Length..]);
                if (field != WorkforceImportField.Ignored && !claimed.Add(answer.TargetKey)) { rejected++; continue; }
                // An identity suggestion is applied only if the column passes the normal identity rules.
                if (field == WorkforceImportField.EmployeeNumber && !IsTrustworthyIdentifier(derived.Cells, column)) { rejected++; continue; }
                accepted++;
                if (plan.ColumnOrigins.GetValueOrDefault(column) == ImportResolutionOrigin.Administrator) continue;
                plan.ColumnMappings[column] = field;
                plan.ColumnOrigins[column] = ImportResolutionOrigin.SemanticSuggestion;
                applied.Add(new ImportAppliedSuggestion(question.Key, question.Kind, answer.TargetKey, question.SourceLabel));
            }
            else if (question.Kind == WorkforceImportSemanticKinds.LifecycleVocabulary)
            {
                var value = question.Key["status:".Length..];
                accepted++;
                if (plan.VocabularyOrigins.GetValueOrDefault(value) == ImportResolutionOrigin.Administrator) continue;
                plan.LifecycleVocabulary[value] = Enum.Parse<WorkforceLifecycle>(answer.TargetKey["lifecycle:".Length..]);
                plan.VocabularyOrigins[value] = ImportResolutionOrigin.SemanticSuggestion;
                applied.Add(new ImportAppliedSuggestion(question.Key, question.Kind, answer.TargetKey, question.SourceLabel));
            }
            else rejected++;
        }
        abstained += request.Questions.Count(q => !answered.Contains(q.Key));

        if (applied.Count > 0)
        {
            session.ReplaceMappingPlan(plan.Serialize(), actor);
            await derivation.RecomputeAsync(session, cancellationToken);
        }
        return new ImportSemanticRunOutcome(returned, accepted, rejected, abstained, applied);
    }

    /// <summary>
    /// The Workforce identity rules a column must satisfy to identify employees: filled on every row,
    /// unique across the file, and shaped like an identifier (not a date, name or email).
    /// </summary>
    internal static bool IsTrustworthyIdentifier(IReadOnlyList<IReadOnlyList<string?>> cells, int column)
    {
        if (cells.Count == 0) return false;
        var values = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in cells)
        {
            var value = column < row.Count ? row[column]?.Trim() : null;
            if (string.IsNullOrEmpty(value) || !IdentifierShape().IsMatch(value) || !values.Add(value)) return false;
        }
        return true;
    }

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._/\-]{0,39}$")]
    private static partial Regex IdentifierShape();

    private async Task<(WorkforceImportSession Session, WorkforceImportMatchState Derived)> LoadAndDeriveAsync(
        Guid sessionId, CancellationToken cancellationToken, bool tracked = false)
    {
        var sessions = tracked ? dbContext.WorkforceImportSessions : dbContext.WorkforceImportSessions.AsNoTracking();
        var session = await sessions.Include(s => s.Source).SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken)
            ?? throw new WorkforceImportNotFoundException(sessionId);
        var rows = await dbContext.WorkforceImportRows.AsNoTracking().Where(r => r.SessionId == sessionId).ToListAsync(cancellationToken);
        return (session, await derivation.InterpretAsync(session, rows, cancellationToken));
    }

    private Task<bool> HasConsentAsync(Guid sessionId, CancellationToken cancellationToken)
        => ImportSemanticConsentPolicy.HasConsentAsync(
            dbContext, options.ConsentMode, provider.ProviderName, WorkforceImportSemanticVersions.DataContract, sessionId, cancellationToken);

    /// <summary>Status values are business vocabulary, but they are still bounded and never contain markup.</summary>
    private static string Sanitize(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length > 48 ? trimmed[..48] : trimmed;
    }

    private static string FieldLabel(WorkforceImportField field) => field switch
    {
        WorkforceImportField.EmployeeNumber => "Employee identifier",
        WorkforceImportField.FirstName => "First name",
        WorkforceImportField.LastName => "Last name",
        WorkforceImportField.FullName => "Full name",
        WorkforceImportField.PreferredName => "Preferred name",
        WorkforceImportField.WorkEmail => "Work email",
        WorkforceImportField.EmploymentStart => "Employment start date",
        WorkforceImportField.WorkEffectiveFrom => "Current assignment start date",
        WorkforceImportField.Organization => "Organization reference",
        WorkforceImportField.DisplayTitle => "Job title",
        WorkforceImportField.Location => "Work location",
        WorkforceImportField.Manager => "Manager reference",
        WorkforceImportField.WorkerReference => "Row reference used by manager references",
        WorkforceImportField.ManagerReference => "Manager row reference",
        WorkforceImportField.LifecycleStatus => "Employment status",
        WorkforceImportField.EmploymentEnd => "Employment end date",
        _ => field.ToString(),
    };
}
