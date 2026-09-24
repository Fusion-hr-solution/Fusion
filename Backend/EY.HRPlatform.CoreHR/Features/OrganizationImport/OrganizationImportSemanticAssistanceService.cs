using System.Diagnostics;
using System.Text;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
    private readonly TimeProvider clock = timeProvider ?? TimeProvider.System;

    private TimeSpan UploadBudget => TimeSpan.FromSeconds(Math.Clamp(options.UploadBudgetSeconds, 1, 60));
    private TimeSpan InteractiveBudget => TimeSpan.FromSeconds(Math.Clamp(options.InteractiveBudgetSeconds, 1, 90));
    private TimeSpan CallTimeout => TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 1, 60));
    private int MaxRetries => Math.Clamp(options.MaxRetries, 0, 2);
    private OrganizationImportSemanticConsentMode ConsentMode
        => options.ConsentMode;
    private bool Available => provider.IsConfigured;

    public async Task<OrganizationImportSemanticAssistanceDto> DescribeAsync(
        OrganizationImportSession session,
        OrganizationImportInterpretation review,
        CancellationToken cancellationToken)
    {
        var context = contextBuilder.Build(session, review);
        var request = context.Request;
        var remaining = request?.Issues.Count ?? 0;
        var latest = await dbContext.OrganizationImportSemanticAttempts.AsNoTracking()
            .Where(item => item.SessionId == session.Id && item.Status != OrganizationImportSemanticAttemptStatus.Stale)
            .OrderByDescending(item => item.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);

        if (latest is null)
        {
            if (request is null)
                return OrganizationImportSemanticAssistanceDto.Of(
                    context.ExceedsPayloadBudget ? OrganizationImportSemanticAssistanceState.Skipped : OrganizationImportSemanticAssistanceState.NotNeeded,
                    null, 0);
            if (!Available)
                return OrganizationImportSemanticAssistanceDto.Of(OrganizationImportSemanticAssistanceState.Skipped, null, remaining);
            if (!await HasConsentAsync(session.Id, cancellationToken))
                return OrganizationImportSemanticAssistanceDto.Of(OrganizationImportSemanticAssistanceState.AwaitingConsent, request.InputFingerprint, remaining)
                    with { ConsentScope = ConsentScope };
            return OrganizationImportSemanticAssistanceDto.Of(OrganizationImportSemanticAssistanceState.Ready, request.InputFingerprint, remaining)
                with { CanRetry = true };
        }

        var runnable = request is not null && Available;
        if (latest.Status == OrganizationImportSemanticAttemptStatus.Running)
        {
            var abandoned = latest.IsAbandoned(InteractiveBudget);
            return Contribution(latest, request, remaining) with
            {
                State = abandoned ? OrganizationImportSemanticAssistanceState.Failed : OrganizationImportSemanticAssistanceState.Running,
                FailureCategory = abandoned ? OrganizationImportSemanticFailureCategory.Interrupted : null,
                CanRetry = abandoned && runnable,
            };
        }

        if (latest.Status == OrganizationImportSemanticAttemptStatus.Failed)
        {
            var retryAllowed = runnable
                && latest.FailureCategory is { } category && OrganizationImportSemanticFailures.IsTransient(category)
                && (latest.RetryAfter is null || latest.RetryAfter <= clock.GetUtcNow().UtcDateTime);
            return Contribution(latest, request, remaining) with
            {
                State = OrganizationImportSemanticAssistanceState.Failed,
                CanRetry = retryAllowed,
            };
        }

        // Succeeded. It becomes stale only when questions appear that this run was never asked;
        // questions it abstained on are its honest result, not staleness.
        var asked = latest.QuestionKeys().ToHashSet(StringComparer.Ordinal);
        var hasNewQuestions = request is not null && request.Issues.Any(issue => !asked.Contains(issue.Key));
        return Contribution(latest, request, remaining) with
        {
            State = hasNewQuestions && runnable
                ? OrganizationImportSemanticAssistanceState.Stale
                : OrganizationImportSemanticAssistanceState.Succeeded,
            CanRetry = hasNewQuestions && runnable,
        };
    }

    public async Task RunAfterUploadAsync(Guid sessionId, OrganizationImportActor actor, CancellationToken cancellationToken)
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
                OrganizationImportSemanticTelemetry.RecordNotNeeded();
                return;
            }
            // Per-import consent cannot exist before the administrator has seen the import.
            if (ConsentMode == OrganizationImportSemanticConsentMode.PerImport) return;
            if (!await HasConsentAsync(sessionId, cancellationToken)) return;
            if (await dbContext.OrganizationImportSemanticAttempts.AnyAsync(item => item.SessionId == sessionId, cancellationToken)) return;
            await RunCoreAsync(session, request, OrganizationImportSemanticTrigger.Upload, UploadBudget, actor, cancellationToken);
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
        RunOrganizationImportSemanticAssistanceRequest runRequest,
        OrganizationImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        if (session.Status != OrganizationImportStatus.Active)
            throw Problem("ImportTerminal", "Only an active import can use automatic matching.");
        var review = await interpreter.InterpretAsync(session, cancellationToken);
        var request = contextBuilder.Build(session, review).Request
            ?? throw Problem("SemanticAssistanceNotNeeded", "Nothing is left for automatic matching to help with.");
        if (string.IsNullOrWhiteSpace(runRequest.InputFingerprint) || !FixedEquals(request.InputFingerprint, runRequest.InputFingerprint))
            throw Problem("SemanticSuggestionsChanged", "The import changed. Review the current mappings and try again.");
        if (!Available)
            throw Problem("SemanticAssistanceUnavailable", "Automatic matching is not available. Finish the mappings manually.");

        if (!await HasConsentAsync(sessionId, cancellationToken))
        {
            if (!runRequest.GrantTenantConsent)
                throw Problem("SemanticConsentRequired", "Automatic matching needs to be turned on first.");
            var perImport = ConsentMode == OrganizationImportSemanticConsentMode.PerImport;
            dbContext.OrganizationImportSemanticConsents.Add(OrganizationImportSemanticConsent.Grant(
                tenantContext.TenantId, provider.ProviderName, OrganizationImportSemanticVersions.DataContract, actor,
                perImport ? sessionId : null));
            try { await dbContext.SaveChangesAsync(cancellationToken); }
            catch (DbUpdateException) { dbContext.ChangeTracker.Clear(); } // granted concurrently; the active consent exists
            logger.LogInformation("Organization import semantic consent granted. Provider={Provider} Mode={Mode}", provider.ProviderName, ConsentMode);
            session = await LoadSessionAsync(sessionId, cancellationToken);
        }

        var latest = await dbContext.OrganizationImportSemanticAttempts.AsNoTracking()
            .Where(item => item.SessionId == sessionId && item.Status != OrganizationImportSemanticAttemptStatus.Stale)
            .OrderByDescending(item => item.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);
        if (latest is { Status: OrganizationImportSemanticAttemptStatus.Running } && !latest.IsAbandoned(InteractiveBudget)) return;
        if (latest is { Status: OrganizationImportSemanticAttemptStatus.Succeeded }
            && request.Issues.All(issue => latest.QuestionKeys().Contains(issue.Key))) return;
        if (latest is { Status: OrganizationImportSemanticAttemptStatus.Failed, RetryAfter: { } retryAfter }
            && retryAfter > clock.GetUtcNow().UtcDateTime)
            throw Problem("SemanticSuggestionsRateLimited", "Automatic matching can be retried shortly. You can keep mapping manually.");

        await RunCoreAsync(session, request, OrganizationImportSemanticTrigger.Administrator, InteractiveBudget, actor, cancellationToken);
    }

    public async Task RecordOverridesAsync(Guid sessionId, int overriddenCount, CancellationToken cancellationToken)
    {
        if (overriddenCount <= 0) return;
        var attempt = await dbContext.OrganizationImportSemanticAttempts
            .Where(item => item.SessionId == sessionId
                && item.Status == OrganizationImportSemanticAttemptStatus.Succeeded
                && item.SuggestionsApplied > 0)
            .OrderByDescending(item => item.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);
        if (attempt is null) return;
        attempt.RecordOverrides(overriddenCount);
        OrganizationImportSemanticTelemetry.RecordOverrides(attempt.Provider, attempt.Model, overriddenCount);
    }

    private async Task RunCoreAsync(
        OrganizationImportSession session,
        OrganizationImportSemanticRequest request,
        OrganizationImportSemanticTrigger trigger,
        TimeSpan budget,
        OrganizationImportActor actor,
        CancellationToken cancellationToken)
    {
        var attempts = await dbContext.OrganizationImportSemanticAttempts
            .Where(item => item.SessionId == session.Id)
            .ToListAsync(cancellationToken);
        foreach (var abandoned in attempts.Where(item => item.IsAbandoned(InteractiveBudget)))
            abandoned.Fail(OrganizationImportSemanticFailureCategory.Interrupted, 0, 0, diagnosticCode: "RunAbandoned");

        var attempt = OrganizationImportSemanticAttempt.Start(
            tenantContext.TenantId,
            session.Id,
            attempts.Count == 0 ? 1 : attempts.Max(item => item.AttemptOrdinal) + 1,
            trigger,
            request,
            provider.ProviderName,
            provider.ModelName);
        dbContext.OrganizationImportSemanticAttempts.Add(attempt);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsAttemptClaimConflict(exception))
        {
            // A concurrent request claimed this run; its outcome will be the one described.
            dbContext.ChangeTracker.Clear();
            return;
        }

        OrganizationImportSemanticTelemetry.RecordRun(provider.ProviderName, provider.ModelName, trigger, request.Issues.Count);
        logger.LogInformation(
            "Organization import semantic assistance started. Trigger={Trigger} Provider={Provider} Model={Model} PromptVersion={PromptVersion} Questions={Questions} AttemptOrdinal={AttemptOrdinal}",
            trigger, provider.ProviderName, provider.ModelName, OrganizationImportSemanticVersions.Prompt, request.Issues.Count, attempt.AttemptOrdinal);

        var stopwatch = Stopwatch.StartNew();
        var reused = await FindReusableAsync(request, cancellationToken);
        OrganizationImportSemanticProviderResult? providerResult = null;
        var retries = 0;
        if (reused is not null)
        {
            providerResult = new OrganizationImportSemanticProviderResult(
                reused.AppliedSuggestions()
                    .Select(item => new OrganizationImportSemanticAnswer(item.QuestionKey, OrganizationImportSemanticDisposition.Suggest, item.TargetKey))
                    .ToList(),
                null, null);
            OrganizationImportSemanticTelemetry.RecordReuse();
        }
        else
        {
            try
            {
                (providerResult, retries) = await CallWithRetriesAsync(request, budget, stopwatch, cancellationToken);
            }
            catch (RetriesExhausted exception)
            {
                await FinishAsync(attempt.Id, running => running.Fail(
                    exception.Category, Elapsed(stopwatch), exception.Retries,
                    exception.RetryAfter, DiagnosticFor(exception.Category)));
                OrganizationImportSemanticTelemetry.RecordFailure(provider.ProviderName, provider.ModelName, stopwatch.Elapsed.TotalMilliseconds, exception.Category);
                logger.LogInformation(
                    "Organization import semantic assistance failed. Category={Category} LatencyMs={LatencyMs}",
                    exception.Category, Elapsed(stopwatch));
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                await FinishAsync(attempt.Id, running => running.Fail(
                    OrganizationImportSemanticFailureCategory.Interrupted, Elapsed(stopwatch), retries, diagnosticCode: "RequestInterrupted"));
                throw;
            }
        }

        // The provider answered for the import as it was. Apply only against the import as it is now.
        dbContext.ChangeTracker.Clear();
        var current = await LoadSessionAsync(session.Id, cancellationToken);
        var currentReview = await interpreter.InterpretAsync(current, cancellationToken);
        var currentRequest = contextBuilder.Build(current, currentReview).Request;
        var persisted = await dbContext.OrganizationImportSemanticAttempts.SingleAsync(item => item.Id == attempt.Id, cancellationToken);
        if (currentRequest is null || !FixedEquals(currentRequest.InputFingerprint, request.InputFingerprint))
        {
            persisted.MarkStale();
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Organization import semantic result is stale and was not applied. AttemptOrdinal={AttemptOrdinal}", persisted.AttemptOrdinal);
            return;
        }

        var validation = Validate(providerResult!.Answers, currentRequest);
        var applied = ApplyToDecisions(current, currentRequest, currentReview, validation.Accepted, actor);
        if (applied.Count > 0)
        {
            var reinterpreted = await interpreter.InterpretAsync(current, cancellationToken);
            current.ApplyMappingPlan(reinterpreted.MappingPlan
                ?? throw new InvalidOperationException("The mapping plan is unavailable."));
        }
        var outcome = new OrganizationImportSemanticRunOutcome(
            validation.Returned, validation.Accepted.Count, validation.Rejected, validation.Abstentions, applied);
        persisted.Succeed(outcome, reused is null ? providerResult : null, Elapsed(stopwatch), retries, reused?.Id);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The administrator changed the import while the provider was answering. Their change
            // stands; this run's answers are dropped rather than merged over it.
            dbContext.ChangeTracker.Clear();
            await FinishAsync(attempt.Id, running => running.MarkStale());
            return;
        }

        OrganizationImportSemanticTelemetry.RecordSuccess(
            provider.ProviderName, provider.ModelName, stopwatch.Elapsed.TotalMilliseconds, outcome, retries, reused is not null);
        logger.LogInformation(
            "Organization import semantic assistance succeeded. Questions={Questions} Returned={Returned} Accepted={Accepted} Rejected={Rejected} Applied={Applied} Abstentions={Abstentions} Retries={Retries} Reused={Reused} LatencyMs={LatencyMs}",
            request.Issues.Count, outcome.Returned, outcome.Accepted, outcome.Rejected, outcome.Applied.Count, outcome.Abstentions,
            retries, reused is not null, Elapsed(stopwatch));
    }

    /// <summary>
    /// One call plus at most <see cref="MaxRetries"/> retries for transient failures, with
    /// exponential backoff and jitter, all inside the run's budget. Credential and configuration
    /// failures are never retried; an unfinished budget ends the run as a timeout.
    /// </summary>
    private async Task<(OrganizationImportSemanticProviderResult Result, int Retries)> CallWithRetriesAsync(
        OrganizationImportSemanticRequest request,
        TimeSpan budget,
        Stopwatch stopwatch,
        CancellationToken cancellationToken)
    {
        var retries = 0;
        while (true)
        {
            var remaining = budget - stopwatch.Elapsed;
            if (remaining <= TimeSpan.FromMilliseconds(250))
                throw new RetriesExhausted(OrganizationImportSemanticFailureCategory.Timeout, null, retries);
            using var call = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            call.CancelAfter(remaining < CallTimeout ? remaining : CallTimeout);
            OrganizationImportSemanticProviderException failure;
            try
            {
                return (await provider.SuggestAsync(request, call.Token), retries);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (OperationCanceledException) { failure = new(OrganizationImportSemanticFailureCategory.Timeout, "Timed out."); }
            catch (HttpRequestException) { failure = new(OrganizationImportSemanticFailureCategory.ProviderUnavailable, "Unavailable."); }
            catch (OrganizationImportSemanticProviderException exception) { failure = exception; }
            catch (Exception) { failure = new(OrganizationImportSemanticFailureCategory.ProviderUnavailable, "Unavailable."); }

            if (!failure.Retryable || retries >= MaxRetries)
                throw new RetriesExhausted(failure.Category, failure.RetryAfter, retries);
            var delay = TimeSpan.FromMilliseconds(400 * Math.Pow(2, retries) + Random.Shared.Next(0, 250));
            if (failure.RetryAfter is { } retryAfter && retryAfter - clock.GetUtcNow().UtcDateTime is var wait && wait > delay)
                delay = wait;
            if (stopwatch.Elapsed + delay + TimeSpan.FromSeconds(1) >= budget)
                throw new RetriesExhausted(failure.Category, failure.RetryAfter, retries);
            OrganizationImportSemanticTelemetry.RecordRetry(provider.ProviderName, provider.ModelName, failure.Category);
            await Task.Delay(delay, clock, cancellationToken);
            retries++;
        }
    }

    private sealed record ValidationResult(
        int Returned,
        int Rejected,
        int Abstentions,
        IReadOnlyList<(OrganizationImportSemanticIssue Issue, string TargetKey)> Accepted);

    /// <summary>
    /// Every answer passes ordinary code before it can touch the plan: the question must still be
    /// open, the target must be one Fusion allowed for it, a field can be claimed once, and type
    /// suggestions must be coherent with the source's own topology. Anything else is discarded.
    /// </summary>
    private static ValidationResult Validate(
        IReadOnlyList<OrganizationImportSemanticAnswer> answers,
        OrganizationImportSemanticRequest request)
    {
        var issues = request.Issues.ToDictionary(issue => issue.Key, StringComparer.Ordinal);
        var answered = new HashSet<string>(StringComparer.Ordinal);
        var claimedFields = new HashSet<string>(StringComparer.Ordinal);
        var accepted = new List<(OrganizationImportSemanticIssue Issue, string TargetKey)>();
        var returned = 0;
        var rejected = 0;
        var abstained = 0;
        foreach (var answer in answers)
        {
            if (!issues.TryGetValue(answer.QuestionKey, out var issue) || !answered.Add(answer.QuestionKey))
            {
                if (answer.Disposition == OrganizationImportSemanticDisposition.Suggest) { returned++; rejected++; }
                continue;
            }
            if (answer.Disposition == OrganizationImportSemanticDisposition.Abstain || answer.TargetKey is null)
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
    private static List<OrganizationImportAppliedSuggestion> ApplyToDecisions(
        OrganizationImportSession session,
        OrganizationImportSemanticRequest request,
        OrganizationImportInterpretation review,
        IReadOnlyList<(OrganizationImportSemanticIssue Issue, string TargetKey)> accepted,
        OrganizationImportActor actor)
    {
        var decisions = (OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)
            ?? new OrganizationImportDecisions()).Normalize();
        var fieldMappings = new Dictionary<string, int?>(decisions.FieldMappings!, StringComparer.Ordinal);
        var fieldOrigins = new Dictionary<string, OrganizationImportResolutionOrigin>(decisions.FieldMappingOrigins!, StringComparer.Ordinal);
        var typeMappings = new Dictionary<string, Guid>(decisions.TypeMappings!, StringComparer.OrdinalIgnoreCase);
        var typeOrigins = new Dictionary<string, OrganizationImportResolutionOrigin>(decisions.TypeMappingOrigins!, StringComparer.OrdinalIgnoreCase);
        var shape = decisions.Shape;
        var shapeOrigin = decisions.ShapeDecisionOrigin;
        var applied = new List<OrganizationImportAppliedSuggestion>();

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
                    shapeOrigin = OrganizationImportResolutionOrigin.SemanticSuggestion;
                    break;
                case OrganizationImportSemanticKinds.FieldMapping:
                    if (issue.SourceColumnIndex is not int column || !targetKey.StartsWith("field:", StringComparison.Ordinal)) continue;
                    var field = targetKey["field:".Length..];
                    if (fieldMappings.TryGetValue(field, out var decided) && decided is not null) continue;
                    if (fieldMappings.Values.Contains(column)) continue;
                    fieldMappings[field] = column;
                    fieldOrigins[field] = OrganizationImportResolutionOrigin.SemanticSuggestion;
                    break;
                case OrganizationImportSemanticKinds.OrganizationTypeMapping:
                    if (string.IsNullOrWhiteSpace(issue.SourceLabel)
                        || typeMappings.ContainsKey(issue.SourceLabel)
                        || !targetKey.StartsWith("type:", StringComparison.Ordinal)
                        || !Guid.TryParse(targetKey["type:".Length..], out var typeId)
                        || review.TypeOptions.All(type => type.Id != typeId))
                        continue;
                    typeMappings[issue.SourceLabel] = typeId;
                    typeOrigins[issue.SourceLabel] = OrganizationImportResolutionOrigin.SemanticSuggestion;
                    break;
                default:
                    continue;
            }
            applied.Add(new OrganizationImportAppliedSuggestion(issue.Key, issue.Kind, targetKey, issue.SourceLabel));
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
    private static List<(OrganizationImportSemanticIssue Issue, string TargetKey)> CorroborateTypeSystem(
        List<(OrganizationImportSemanticIssue Issue, string TargetKey)> accepted,
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

    /// <summary>
    /// A successful earlier run on the identical input, under the same prompt, result contract,
    /// provider and model. Refreshing or re-uploading the same file reuses it instead of asking again.
    /// </summary>
    private Task<OrganizationImportSemanticAttempt?> FindReusableAsync(
        OrganizationImportSemanticRequest request,
        CancellationToken cancellationToken)
        => dbContext.OrganizationImportSemanticAttempts.AsNoTracking()
            .Where(item => item.InputFingerprint == request.InputFingerprint
                && item.Status == OrganizationImportSemanticAttemptStatus.Succeeded
                && item.ReusedFromAttemptId == null
                && item.PromptVersion == OrganizationImportSemanticVersions.Prompt
                && item.ResultContractVersion == request.ResultContractVersion
                && item.DataContractVersion == OrganizationImportSemanticVersions.DataContract
                && item.Provider == provider.ProviderName
                && item.Model == provider.ModelName)
            .OrderByDescending(item => item.CompletedAt)
            .FirstOrDefaultAsync(cancellationToken);

    private OrganizationImportSemanticConsentScope ConsentScope
        => ConsentMode == OrganizationImportSemanticConsentMode.PerImport
            ? OrganizationImportSemanticConsentScope.Import
            : OrganizationImportSemanticConsentScope.Tenant;

    /// <summary>Whether external processing is allowed for this import under the configured consent mode.</summary>
    private Task<bool> HasConsentAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        if (ConsentMode == OrganizationImportSemanticConsentMode.Implicit) return Task.FromResult(true);
        Guid? scope = ConsentMode == OrganizationImportSemanticConsentMode.PerImport ? sessionId : null;
        return dbContext.OrganizationImportSemanticConsents.AnyAsync(consent =>
            consent.Provider == provider.ProviderName
            && consent.DataContractVersion == OrganizationImportSemanticVersions.DataContract
            && consent.SessionId == scope
            && consent.RevokedAt == null, cancellationToken);
    }

    private static OrganizationImportSemanticAssistanceDto Contribution(
        OrganizationImportSemanticAttempt attempt,
        OrganizationImportSemanticRequest? request,
        int remaining)
        => new(
            OrganizationImportSemanticAssistanceState.Succeeded,
            request?.InputFingerprint,
            attempt.QuestionsSubmitted,
            attempt.SuggestionsApplied,
            attempt.Abstentions,
            remaining,
            attempt.CompletedAt,
            false,
            attempt.Status == OrganizationImportSemanticAttemptStatus.Failed ? attempt.RetryAfter : null,
            attempt.Status == OrganizationImportSemanticAttemptStatus.Failed ? attempt.FailureCategory : null);

    private async Task FinishAsync(Guid attemptId, Action<OrganizationImportSemanticAttempt> finish)
    {
        dbContext.ChangeTracker.Clear();
        var attempt = await dbContext.OrganizationImportSemanticAttempts.SingleAsync(item => item.Id == attemptId, CancellationToken.None);
        if (attempt.Status != OrganizationImportSemanticAttemptStatus.Running) return;
        finish(attempt);
        await dbContext.SaveChangesAsync(CancellationToken.None);
    }

    private async Task<OrganizationImportSession> LoadSessionAsync(Guid sessionId, CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException("Organization import", sessionId);

    private static string DiagnosticFor(OrganizationImportSemanticFailureCategory category) => category switch
    {
        OrganizationImportSemanticFailureCategory.InvalidOutput => "ProviderResponseInvalid",
        OrganizationImportSemanticFailureCategory.Timeout => "BudgetOrCallTimeout",
        _ => "ProviderRequestFailed",
    };

    private static int Elapsed(Stopwatch stopwatch) => (int)Math.Min(stopwatch.ElapsedMilliseconds, int.MaxValue);

    private static OrganizationImportReviewException Problem(string code, string message)
        => new(code, message, StatusCodes.Status409Conflict);

    private static string Normalize(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static bool IsAttemptClaimConflict(DbUpdateException exception)
        => exception.InnerException is PostgresException postgres
            && postgres.SqlState == PostgresErrorCodes.UniqueViolation
            && postgres.ConstraintName == AttemptUniqueConstraint;

    private static bool FixedEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length
            && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }

    /// <summary>The final failure of a run, carrying how many retries were spent reaching it.</summary>
    private sealed class RetriesExhausted(
        OrganizationImportSemanticFailureCategory category,
        DateTime? retryAfter,
        int retries) : Exception("Automatic matching could not complete.")
    {
        public OrganizationImportSemanticFailureCategory Category { get; } = category;
        public DateTime? RetryAfter { get; } = retryAfter;
        public int Retries { get; } = retries;
    }
}
