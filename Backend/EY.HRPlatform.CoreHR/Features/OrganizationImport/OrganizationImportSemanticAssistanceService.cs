using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>
/// Semantic assistance for Organization Import: deterministic-first, one bounded provider call
/// over the questions deterministic interpretation left open, strict validation, and automatic
/// application of what survives into the Mapping Plan with <c>SemanticSuggestion</c> provenance.
/// The administrator keeps authority: suggestions never overwrite their decisions, and every
/// applied suggestion stays editable in Match. Assistance never decides Match readiness.
/// </summary>
public sealed class OrganizationImportSemanticAssistanceService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IOrganizationImportInterpreter interpreter,
    IOrganizationImportSemanticContextBuilder contextBuilder,
    IOrganizationImportSemanticProvider provider,
    OrganizationImportSemanticAssistanceOptions options,
    ILogger<OrganizationImportSemanticAssistanceService> logger,
    TimeProvider? timeProvider = null) : IOrganizationImportSemanticAssistanceService
{
    private const string AttemptUniqueConstraint = "UX_OrganizationImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal";

    private readonly ImportSemanticRunner runner = new(
        dbContext,
        ImportSemanticBudget.From(options.UploadBudgetSeconds, options.InteractiveBudgetSeconds, options.TimeoutSeconds, options.MaxRetries),
        ImportSemanticTelemetry.Organization,
        AttemptUniqueConstraint,
        logger,
        timeProvider);

    private ImportSemanticConsentMode ConsentMode => options.ConsentMode;
    private bool Available => provider.IsConfigured;

    public async Task<ImportSemanticAssistanceDto> DescribeAsync(
        OrganizationImportSession session,
        OrganizationImportInterpretation review,
        CancellationToken cancellationToken)
    {
        var context = contextBuilder.Build(session, review);
        var request = context.Request;
        var latest = await ImportSemanticRunner.LatestAsync(dbContext.OrganizationImportSemanticAttempts, session.Id, cancellationToken);
        var hasConsent = latest is not null || request is null || !Available || await HasConsentAsync(session.Id, cancellationToken);
        return runner.Describe(
            latest,
            request?.InputFingerprint,
            request?.Issues.Select(issue => issue.Key).ToList(),
            context.ExceedsPayloadBudget,
            Available,
            hasConsent,
            ImportSemanticConsentPolicy.ScopeOf(ConsentMode));
    }

    public async Task RunAfterUploadAsync(Guid sessionId, ImportActor actor, CancellationToken cancellationToken)
    {
        try
        {
            if (!Available) return;
            var session = await LoadSessionAsync(sessionId, cancellationToken);
            if (session.Status != OrganizationImportStatus.Active) return;
            var review = await interpreter.InterpretAsync(session, cancellationToken);
            var request = contextBuilder.Build(session, review).Request;
            if (request is null)
            {
                ImportSemanticTelemetry.Organization.RecordNotNeeded();
                return;
            }
            // Per-import consent cannot exist before the administrator has seen the import.
            if (ConsentMode == ImportSemanticConsentMode.PerImport) return;
            if (!await HasConsentAsync(sessionId, cancellationToken)) return;
            if (await dbContext.OrganizationImportSemanticAttempts.AnyAsync(item => item.SessionId == sessionId, cancellationToken)) return;
            await runner.RunAsync(dbContext.OrganizationImportSemanticAttempts,
                BuildRun(session, request, ImportSemanticTrigger.Upload, runner.UploadBudget, actor), cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // Upload success never depends on the provider. Whatever happened, Match opens with the
            // deterministic interpretation and the administrator finishes it manually.
            logger.LogWarning(
                "Organization import semantic assistance could not run after upload. ErrorType={ErrorType}",
                exception.GetType().Name);
        }
    }

    public async Task RunAsync(
        Guid sessionId,
        RunImportSemanticAssistanceRequest runRequest,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        if (session.Status != OrganizationImportStatus.Active)
            throw Problem("ImportTerminal", "Only an active import can use automatic matching.");
        var review = await interpreter.InterpretAsync(session, cancellationToken);
        var request = contextBuilder.Build(session, review).Request
            ?? throw Problem("SemanticAssistanceNotNeeded", "Nothing is left for automatic matching to help with.");
        if (!ImportFingerprint.Matches(request.InputFingerprint, runRequest.InputFingerprint))
            throw Problem("SemanticSuggestionsChanged", "The import changed. Review the current mappings and try again.");
        if (!Available)
            throw Problem("SemanticAssistanceUnavailable", "Automatic matching is not available. Finish the mappings manually.");

        if (!await HasConsentAsync(sessionId, cancellationToken))
        {
            if (!runRequest.GrantTenantConsent)
                throw Problem("SemanticConsentRequired", "Automatic matching needs to be turned on first.");
            await ImportSemanticConsentPolicy.GrantAsync(
                dbContext, tenantContext.TenantId, ConsentMode, provider.ProviderName,
                OrganizationImportSemanticVersions.DataContract, actor, sessionId, cancellationToken);
            logger.LogInformation("Organization import semantic consent granted. Provider={Provider} Mode={Mode}", provider.ProviderName, ConsentMode);
            session = await LoadSessionAsync(sessionId, cancellationToken);
        }

        var latest = await ImportSemanticRunner.LatestAsync(dbContext.OrganizationImportSemanticAttempts, sessionId, cancellationToken);
        if (!runner.ShouldStartInteractive(latest, request.Issues.Select(issue => issue.Key).ToList(), out var rateLimited))
        {
            if (rateLimited)
                throw Problem("SemanticSuggestionsRateLimited", "Automatic matching can be retried shortly. You can keep mapping manually.");
            return;
        }

        await runner.RunAsync(dbContext.OrganizationImportSemanticAttempts,
            BuildRun(session, request, ImportSemanticTrigger.Administrator, runner.InteractiveBudget, actor), cancellationToken);
    }

    public async Task RecordOverridesAsync(Guid sessionId, int overriddenCount, CancellationToken cancellationToken)
    {
        if (overriddenCount <= 0) return;
        var attempt = await dbContext.OrganizationImportSemanticAttempts
            .Where(item => item.SessionId == sessionId
                && item.Status == ImportSemanticAttemptStatus.Succeeded
                && item.SuggestionsApplied > 0)
            .OrderByDescending(item => item.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);
        if (attempt is null) return;
        attempt.RecordOverrides(overriddenCount);
        ImportSemanticTelemetry.Organization.RecordOverrides(attempt.Provider, attempt.Model, overriddenCount);
    }

    private ImportSemanticRun<OrganizationImportSemanticAttempt> BuildRun(
        OrganizationImportSession session,
        OrganizationImportSemanticRequest request,
        ImportSemanticTrigger trigger,
        TimeSpan budget,
        ImportActor actor)
        => new(
            session.Id,
            request.InputFingerprint,
            request.Issues.Count,
            request.ResultContractVersion,
            OrganizationImportSemanticVersions.DataContract,
            OrganizationImportSemanticVersions.Prompt,
            provider.ProviderName,
            provider.ModelName,
            trigger,
            budget,
            ordinal => OrganizationImportSemanticAttempt.Start(
                tenantContext.TenantId, session.Id, ordinal, trigger, request, provider.ProviderName, provider.ModelName),
            token => provider.SuggestAsync(request, token),
            (result, token) => ApplyToCurrentAsync(session.Id, request.InputFingerprint, result, actor, token));

    /// <summary>Validates the answers against the import as it is now and applies what survives; null when the import changed.</summary>
    private async Task<ImportSemanticRunOutcome?> ApplyToCurrentAsync(
        Guid sessionId,
        string askedFingerprint,
        ImportSemanticProviderResult providerResult,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var current = await LoadSessionAsync(sessionId, cancellationToken);
        var currentReview = await interpreter.InterpretAsync(current, cancellationToken);
        var currentRequest = contextBuilder.Build(current, currentReview).Request;
        if (currentRequest is null || !ImportFingerprint.Matches(currentRequest.InputFingerprint, askedFingerprint))
            return null;

        var validation = Validate(providerResult.Answers, currentRequest);
        var applied = ApplyToDecisions(current, currentRequest, currentReview, validation.Accepted, actor);
        if (applied.Count > 0)
        {
            var reinterpreted = await interpreter.InterpretAsync(current, cancellationToken);
            current.ApplyMappingPlan(reinterpreted.MappingPlan
                ?? throw new InvalidOperationException("The mapping plan is unavailable."));
        }
        return new ImportSemanticRunOutcome(
            validation.Returned, validation.Accepted.Count, validation.Rejected, validation.Abstentions, applied);
    }

    private sealed record ValidationResult(
        int Returned,
        int Rejected,
        int Abstentions,
        IReadOnlyList<(ImportSemanticIssue Issue, string TargetKey)> Accepted);

    /// <summary>
    /// Every answer passes ordinary code before it can touch the plan: the question must still be
    /// open, the target must be one Fusion allowed for it, a field can be claimed once, and type
    /// suggestions must be coherent with the source's own topology. Anything else is discarded.
    /// </summary>
    private static ValidationResult Validate(
        IReadOnlyList<ImportSemanticAnswer> answers,
        OrganizationImportSemanticRequest request)
    {
        var issues = request.Issues.ToDictionary(issue => issue.Key, StringComparer.Ordinal);
        var answered = new HashSet<string>(StringComparer.Ordinal);
        var claimedFields = new HashSet<string>(StringComparer.Ordinal);
        var accepted = new List<(ImportSemanticIssue Issue, string TargetKey)>();
        var returned = 0;
        var rejected = 0;
        var abstained = 0;
        foreach (var answer in answers)
        {
            if (!issues.TryGetValue(answer.QuestionKey, out var issue) || !answered.Add(answer.QuestionKey))
            {
                if (answer.Disposition == ImportSemanticDisposition.Suggest) { returned++; rejected++; }
                continue;
            }
            if (answer.Disposition == ImportSemanticDisposition.Abstain || answer.TargetKey is null)
            {
                abstained++;
                continue;
            }
            returned++;
            if (issue.AllowedTargets.All(target => target.Key != answer.TargetKey)
                || (issue.Kind == OrganizationImportSemanticKinds.FieldMapping
                    && (answer.TargetKey == $"field:{OrganizationImportFields.FusionOrgUnitId}" || !claimedFields.Add(answer.TargetKey))))
            {
                rejected++;
                continue;
            }
            accepted.Add((issue, answer.TargetKey));
        }
        abstained += request.Issues.Count(issue => !answered.Contains(issue.Key));

        var coherent = CorroborateTypeSystem(accepted, request);
        rejected += accepted.Count - coherent.Count;
        return new ValidationResult(returned, rejected, abstained, coherent);
    }

    /// <summary>
    /// Writes accepted suggestions into the session's decisions. A question the administrator has
    /// already decided is left alone: human decisions outrank AI proposals.
    /// </summary>
    private static List<ImportAppliedSuggestion> ApplyToDecisions(
        OrganizationImportSession session,
        OrganizationImportSemanticRequest request,
        OrganizationImportInterpretation review,
        IReadOnlyList<(ImportSemanticIssue Issue, string TargetKey)> accepted,
        ImportActor actor)
    {
        var decisions = (OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)
            ?? new OrganizationImportDecisions()).Normalize();
        var fieldMappings = new Dictionary<string, int?>(decisions.FieldMappings!, StringComparer.Ordinal);
        var fieldOrigins = new Dictionary<string, ImportResolutionOrigin>(decisions.FieldMappingOrigins!, StringComparer.Ordinal);
        var typeMappings = new Dictionary<string, Guid>(decisions.TypeMappings!, StringComparer.OrdinalIgnoreCase);
        var typeOrigins = new Dictionary<string, ImportResolutionOrigin>(decisions.TypeMappingOrigins!, StringComparer.OrdinalIgnoreCase);
        var shape = decisions.Shape;
        var shapeOrigin = decisions.ShapeDecisionOrigin;
        var applied = new List<ImportAppliedSuggestion>();

        foreach (var (issue, targetKey) in accepted)
        {
            switch (issue.Kind)
            {
                case OrganizationImportSemanticKinds.SourceShape:
                    if (shape is not null) continue;
                    shape = targetKey switch
                    {
                        "shape:LevelColumns" => OrganizationImportShape.LevelColumns,
                        "shape:ParentReference" => OrganizationImportShape.ParentReference,
                        _ => null,
                    };
                    if (shape is null) continue;
                    shapeOrigin = ImportResolutionOrigin.SemanticSuggestion;
                    break;
                case OrganizationImportSemanticKinds.FieldMapping:
                    if (issue.SourceColumnIndex is not int column || !targetKey.StartsWith("field:", StringComparison.Ordinal)) continue;
                    var field = targetKey["field:".Length..];
                    if (fieldMappings.TryGetValue(field, out var decided) && decided is not null) continue;
                    if (fieldMappings.Values.Contains(column)) continue;
                    fieldMappings[field] = column;
                    fieldOrigins[field] = ImportResolutionOrigin.SemanticSuggestion;
                    break;
                case OrganizationImportSemanticKinds.OrganizationTypeMapping:
                    if (string.IsNullOrWhiteSpace(issue.SourceLabel)
                        || typeMappings.ContainsKey(issue.SourceLabel)
                        || !targetKey.StartsWith("type:", StringComparison.Ordinal)
                        || !Guid.TryParse(targetKey["type:".Length..], out var typeId)
                        || review.TypeOptions.All(type => type.Id != typeId))
                        continue;
                    typeMappings[issue.SourceLabel] = typeId;
                    typeOrigins[issue.SourceLabel] = ImportResolutionOrigin.SemanticSuggestion;
                    break;
                default:
                    continue;
            }
            applied.Add(new ImportAppliedSuggestion(issue.Key, issue.Kind, targetKey, issue.SourceLabel));
        }

        if (applied.Count == 0) return applied;
        session.ReplaceDecisions(decisions with
        {
            Shape = shape,
            ShapeDecisionOrigin = shapeOrigin,
            FieldMappings = fieldMappings,
            FieldMappingOrigins = fieldOrigins,
            TypeMappings = typeMappings,
            TypeMappingOrigins = typeOrigins,
        }, actor.Normalize());
        return applied;
    }

    /// <summary>
    /// Global coherence check for organization type suggestions. A mapping is incoherent when
    /// source types the file itself differentiates by topology (different depths, root vs non-root,
    /// parent and child of each other) collapse onto one canonical type, and a non-root type can
    /// never be the canonical Organization. Incoherent suggestions are discarded; the labels stay
    /// open for the administrator. Field and shape suggestions are unaffected.
    /// </summary>
    private static List<(ImportSemanticIssue Issue, string TargetKey)> CorroborateTypeSystem(
        List<(ImportSemanticIssue Issue, string TargetKey)> accepted,
        OrganizationImportSemanticRequest request)
    {
        var typeByLabel = request.SourceTypeSystem.ToDictionary(t => t.SourceLabel, StringComparer.OrdinalIgnoreCase);
        if (typeByLabel.Count == 0) return accepted;
        var typeTargetLabel = request.OrganizationTypes.ToDictionary(t => $"type:{t.Id}", t => t.Name, StringComparer.Ordinal);
        var typeSuggestions = accepted
            .Where(item => item.Issue.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping
                && item.Issue.SourceLabel is not null && typeByLabel.ContainsKey(item.Issue.SourceLabel))
            .Select(item => (item.Issue.Key, Source: typeByLabel[item.Issue.SourceLabel!],
                Canonical: typeTargetLabel.GetValueOrDefault(item.TargetKey, item.TargetKey)))
            .ToList();
        if (typeSuggestions.Count < 1) return accepted;

        var incoherent = new HashSet<string>(StringComparer.Ordinal);
        foreach (var candidate in typeSuggestions)
            if (Normalize(candidate.Canonical) == "organization" && !candidate.Source.OccursOnRoot)
                incoherent.Add(candidate.Key);
        foreach (var group in typeSuggestions.GroupBy(item => Normalize(item.Canonical)))
        {
            var members = group.ToList();
            if (members.Count < 2) continue;
            var distinctDepthBands = members.Select(m => m.Source.MinDepth).Distinct().Count();
            var rootAndNonRoot = members.Any(m => m.Source.OccursOnRoot) && members.Any(m => !m.Source.OccursOnRoot);
            var parentChildAmongThem = members.Any(m => members.Any(other =>
                !string.Equals(m.Key, other.Key, StringComparison.Ordinal)
                && m.Source.ChildTypes.Contains(other.Source.SourceLabel, StringComparer.OrdinalIgnoreCase)));
            if (distinctDepthBands > 1 || rootAndNonRoot || parentChildAmongThem)
                foreach (var m in members) incoherent.Add(m.Key);
        }
        return incoherent.Count == 0 ? accepted : accepted.Where(item => !incoherent.Contains(item.Issue.Key)).ToList();
    }

    /// <summary>Whether external processing is allowed for this import under the configured consent mode.</summary>
    private Task<bool> HasConsentAsync(Guid sessionId, CancellationToken cancellationToken)
        => ImportSemanticConsentPolicy.HasConsentAsync(
            dbContext, ConsentMode, provider.ProviderName, OrganizationImportSemanticVersions.DataContract, sessionId, cancellationToken);

    private async Task<OrganizationImportSession> LoadSessionAsync(Guid sessionId, CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException("Organization import", sessionId);

    private static OrganizationImportReviewException Problem(string code, string message)
        => new(code, message, StatusCodes.Status409Conflict);

    private static string Normalize(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
}
