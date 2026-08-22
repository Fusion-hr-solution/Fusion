using System.Diagnostics;
using System.Text;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public sealed class OrganizationImportSemanticAssistanceService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IOrganizationImportInterpreter interpreter,
    IOrganizationImportSemanticContextBuilder contextBuilder,
    IOrganizationImportSemanticProvider provider,
    OrganizationImportSemanticAssistanceOptions options,
    ILogger<OrganizationImportSemanticAssistanceService> logger) : IOrganizationImportSemanticAssistanceService
{
    private const string AttemptUniqueConstraint = "UX_OrganizationImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal";

    public async Task<OrganizationImportSemanticAssistanceDto> DescribeAsync(
        OrganizationImportSession session,
        OrganizationImportReview review,
        CancellationToken cancellationToken)
    {
        var semanticRequest = contextBuilder.Build(session, review);
        if (semanticRequest is null)
        {
            OrganizationImportSemanticTelemetry.RecordEligibility("not_eligible");
            return OrganizationImportSemanticAssistanceDto.NotEligible();
        }
        var attempt = await dbContext.OrganizationImportSemanticAttempts
            .AsNoTracking()
            .Where(item => item.SessionId == session.Id && item.InputFingerprint == semanticRequest.InputFingerprint)
            .OrderByDescending(item => item.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);
        if (attempt is null)
        {
            OrganizationImportSemanticTelemetry.RecordEligibility("eligible");
            return OrganizationImportSemanticAssistanceDto.Eligible(semanticRequest.InputFingerprint);
        }
        OrganizationImportSemanticTelemetry.RecordReuse(attempt.Status.ToString());
        logger.LogDebug(
            "Organization import semantic assistance reused. Status={Status} AttemptOrdinal={AttemptOrdinal}",
            attempt.Status,
            attempt.AttemptOrdinal);
        var mapped = Map(attempt, semanticRequest);
        return attempt.Status == OrganizationImportSemanticAttemptStatus.Pending && IsExpired(attempt)
            ? mapped with
            {
                State = OrganizationImportSemanticAssistanceState.Failed,
                FailureCategory = OrganizationImportSemanticFailureCategory.Interrupted,
            }
            : mapped;
    }

    public async Task<OrganizationImportSemanticAssistanceDto> GenerateAsync(
        Guid sessionId,
        GenerateOrganizationImportSemanticSuggestionsRequest request,
        CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        EnsureActive(session);
        var review = await interpreter.InterpretAsync(session, cancellationToken);
        var semanticRequest = contextBuilder.Build(session, review)
            ?? throw new OrganizationImportReviewException(
                "SemanticSuggestionsNotEligible",
                "This import has no unresolved terms that suggestions can help with.",
                StatusCodes.Status409Conflict);
        if (string.IsNullOrWhiteSpace(request.InputFingerprint)
            || !FixedEquals(semanticRequest.InputFingerprint, request.InputFingerprint))
            throw new OrganizationImportReviewException(
                "SemanticSuggestionsChanged",
                "The source interpretation changed. Review the current result before requesting suggestions.",
                StatusCodes.Status409Conflict);

        var attempts = await dbContext.OrganizationImportSemanticAttempts
            .Where(item => item.SessionId == session.Id)
            .OrderByDescending(item => item.AttemptOrdinal)
            .ToListAsync(cancellationToken);
        var current = attempts.FirstOrDefault(item => item.InputFingerprint == semanticRequest.InputFingerprint);
        if (current is not null)
        {
            if (current.Status is OrganizationImportSemanticAttemptStatus.Pending
                && IsExpired(current))
            {
                current.Fail(OrganizationImportSemanticFailureCategory.Interrupted, 0);
                await dbContext.SaveChangesAsync(CancellationToken.None);
            }
            if (current.Status is OrganizationImportSemanticAttemptStatus.Pending
                or OrganizationImportSemanticAttemptStatus.Available
                or OrganizationImportSemanticAttemptStatus.Applied)
            {
                OrganizationImportSemanticTelemetry.RecordReuse(current.Status.ToString());
                return Map(current, semanticRequest);
            }
            if (current.Status == OrganizationImportSemanticAttemptStatus.Failed && !request.Retry)
            {
                OrganizationImportSemanticTelemetry.RecordReuse(current.Status.ToString());
                return Map(current, semanticRequest);
            }
            if (current.Status == OrganizationImportSemanticAttemptStatus.Failed
                && current.RetryAfter is DateTime retryAfter && retryAfter > DateTime.UtcNow)
                throw new OrganizationImportReviewException(
                    "SemanticSuggestionsRateLimited",
                    "Suggestions can be retried later. Manual review is still available.",
                    StatusCodes.Status409Conflict);
        }

        foreach (var stale in attempts.Where(item => item.InputFingerprint != semanticRequest.InputFingerprint
                     && item.Status is OrganizationImportSemanticAttemptStatus.Pending
                         or OrganizationImportSemanticAttemptStatus.Available
                         or OrganizationImportSemanticAttemptStatus.Failed))
            stale.Supersede();

        var ordinal = attempts.Count == 0 ? 1 : attempts.Max(item => item.AttemptOrdinal) + 1;
        var attempt = OrganizationImportSemanticAttempt.CreatePending(
            tenantContext.TenantId,
            session.Id,
            ordinal,
            semanticRequest.ContractVersion,
            semanticRequest.InputFingerprint,
            provider.ProviderName,
            provider.ModelName,
            semanticRequest.Issues.Select(issue => issue.Key).ToList());
        dbContext.OrganizationImportSemanticAttempts.Add(attempt);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsAttemptClaimConflict(exception))
        {
            dbContext.ChangeTracker.Clear();
            var winner = await dbContext.OrganizationImportSemanticAttempts.AsNoTracking()
                .Where(item => item.SessionId == sessionId && item.InputFingerprint == semanticRequest.InputFingerprint)
                .OrderByDescending(item => item.AttemptOrdinal)
                .FirstAsync(cancellationToken);
            return Map(winner, semanticRequest);
        }

        logger.LogInformation(
            "Organization import semantic assistance started. Provider={Provider} Model={Model} IssueCount={IssueCount} AttemptOrdinal={AttemptOrdinal}",
            provider.ProviderName,
            provider.ModelName,
            semanticRequest.Issues.Count,
            ordinal);
        OrganizationImportSemanticTelemetry.RecordAttempt(provider.ProviderName, provider.ModelName);

        if (!provider.IsConfigured)
        {
            attempt.Fail(OrganizationImportSemanticFailureCategory.NotConfigured, 0);
            OrganizationImportSemanticTelemetry.RecordFailure(
                provider.ProviderName,
                provider.ModelName,
                0,
                OrganizationImportSemanticFailureCategory.NotConfigured);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Map(attempt, semanticRequest);
        }

        var stopwatch = Stopwatch.StartNew();
        OrganizationImportSemanticProviderResult providerResult;
        try
        {
            providerResult = await SuggestWithRetryAsync(semanticRequest, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await FailAttemptAsync(attempt.Id, OrganizationImportSemanticFailureCategory.Interrupted, stopwatch.ElapsedMilliseconds, null);
            throw;
        }
        catch (OrganizationImportSemanticProviderException exception)
        {
            await FailAttemptAsync(attempt.Id, exception.Category, stopwatch.ElapsedMilliseconds, exception.RetryAfter);
            return await ReloadAndMapAsync(attempt.Id, semanticRequest, CancellationToken.None);
        }

        var validated = ValidateSuggestions(providerResult.Suggestions, semanticRequest);
        dbContext.ChangeTracker.Clear();
        var latestSession = await LoadSessionAsync(sessionId, cancellationToken);
        var latestReview = await interpreter.InterpretAsync(latestSession, cancellationToken);
        var latestRequest = contextBuilder.Build(latestSession, latestReview);
        var persistedAttempt = await dbContext.OrganizationImportSemanticAttempts
            .SingleAsync(item => item.Id == attempt.Id && item.SessionId == sessionId, cancellationToken);
        if (latestRequest is null || !FixedEquals(latestRequest.InputFingerprint, semanticRequest.InputFingerprint))
        {
            persistedAttempt.Supersede();
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Organization import semantic assistance result was superseded. AttemptOrdinal={AttemptOrdinal}",
                persistedAttempt.AttemptOrdinal);
            return latestRequest is null
                ? OrganizationImportSemanticAssistanceDto.NotEligible()
                : OrganizationImportSemanticAssistanceDto.Eligible(latestRequest.InputFingerprint);
        }

        if (validated.Count == 0)
            persistedAttempt.Fail(OrganizationImportSemanticFailureCategory.InvalidOutput, (int)stopwatch.ElapsedMilliseconds);
        else
            persistedAttempt.Complete(
                validated,
                (int)Math.Min(stopwatch.ElapsedMilliseconds, int.MaxValue),
                providerResult.InputTokens,
                providerResult.OutputTokens);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Organization import semantic assistance finished. Provider={Provider} Model={Model} Result={Result} ValidSuggestionCount={ValidSuggestionCount} RejectedSuggestionCount={RejectedSuggestionCount} LatencyMs={LatencyMs}",
            persistedAttempt.Provider,
            persistedAttempt.Model,
            persistedAttempt.Status,
            validated.Count,
            Math.Max(0, providerResult.Suggestions.Count - validated.Count),
            persistedAttempt.LatencyMilliseconds);
        OrganizationImportSemanticTelemetry.RecordProviderResult(
            persistedAttempt.Provider,
            persistedAttempt.Model,
            stopwatch.Elapsed.TotalMilliseconds,
            persistedAttempt.Status.ToString(),
            Math.Max(0, providerResult.Suggestions.Count - validated.Count));
        return Map(persistedAttempt, latestRequest);
    }

    public async Task ApplyAsync(
        Guid sessionId,
        Guid attemptId,
        uint expectedSessionVersion,
        ApplyOrganizationImportSemanticSuggestionsRequest request,
        OrganizationImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadSessionAsync(sessionId, cancellationToken);
        EnsureActive(session);
        var attempt = await dbContext.OrganizationImportSemanticAttempts
            .SingleOrDefaultAsync(item => item.Id == attemptId && item.SessionId == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException("Organization import suggestions", attemptId);
        if (attempt.Status != OrganizationImportSemanticAttemptStatus.Available
            || attempt.Version != request.AttemptVersion)
            throw new OrganizationImportReviewException(
                "SemanticSuggestionsChanged",
                "The suggestions changed. Review the current set before applying it.",
                StatusCodes.Status409Conflict);

        var review = await interpreter.InterpretAsync(session, cancellationToken);
        var semanticRequest = contextBuilder.Build(session, review);
        if (semanticRequest is null
            || string.IsNullOrWhiteSpace(request.InputFingerprint)
            || !FixedEquals(semanticRequest.InputFingerprint, request.InputFingerprint)
            || !FixedEquals(semanticRequest.InputFingerprint, attempt.InputFingerprint))
            throw new OrganizationImportReviewException(
                "SemanticSuggestionsChanged",
                "The source interpretation changed. Review the current result before applying suggestions.",
                StatusCodes.Status409Conflict);

        var suggestions = OrganizationImportJson.Deserialize<IReadOnlyList<OrganizationImportSemanticProviderSuggestion>>(attempt.SuggestionsJson) ?? [];
        var reviewed = request.ReviewedItems
            .GroupBy(item => item.IssueKey, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.ToList(), StringComparer.Ordinal);
        if (reviewed.Count != suggestions.Count || reviewed.Values.Any(items => items.Count != 1)
            || suggestions.Any(suggestion => !reviewed.ContainsKey(suggestion.IssueKey)))
            throw InvalidReview();

        var decisions = (OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)
            ?? new OrganizationImportDecisions()).Normalize();
        var fieldMappings = new Dictionary<string, int?>(decisions.FieldMappings!, StringComparer.Ordinal);
        var typeMappings = new Dictionary<string, Guid>(decisions.TypeMappings!, StringComparer.OrdinalIgnoreCase);
        var usedFieldTargets = new HashSet<string>(StringComparer.Ordinal);
        var outcomes = new List<OrganizationImportSemanticReviewRecord>();
        var selectedShape = decisions.Shape;

        foreach (var suggestion in suggestions)
        {
            var item = reviewed[suggestion.IssueKey][0];
            var issue = semanticRequest.Issues.SingleOrDefault(candidate => candidate.Key == suggestion.IssueKey)
                ?? throw InvalidReview();
            if (item.Outcome == OrganizationImportSemanticReviewOutcome.Rejected)
            {
                if (item.TargetKey is not null) throw InvalidReview();
                outcomes.Add(new(item.IssueKey, suggestion.TargetKey, null, item.Outcome));
                continue;
            }

            var targetKey = item.TargetKey ?? throw InvalidReview();
            if (item.Outcome == OrganizationImportSemanticReviewOutcome.Accepted
                && !string.Equals(targetKey, suggestion.TargetKey, StringComparison.Ordinal))
                throw InvalidReview();
            if (issue.AllowedTargets.All(target => target.Key != targetKey)) throw InvalidReview();

            switch (issue.Kind)
            {
                case OrganizationImportSemanticKinds.SourceShape:
                    selectedShape = targetKey switch
                    {
                        "shape:LevelColumns" => OrganizationImportShape.LevelColumns,
                        "shape:ParentReference" => OrganizationImportShape.ParentReference,
                        _ => throw InvalidReview(),
                    };
                    break;
                case OrganizationImportSemanticKinds.FieldMapping:
                    if (issue.SourceColumnIndex is not int columnIndex
                        || !targetKey.StartsWith("field:", StringComparison.Ordinal))
                        throw InvalidReview();
                    var field = targetKey["field:".Length..];
                    if (field == OrganizationImportFields.FusionOrgUnitId
                        || field is not (OrganizationImportFields.Name
                            or OrganizationImportFields.BusinessCode
                            or OrganizationImportFields.Type
                            or OrganizationImportFields.ParentBusinessCode)
                        || !usedFieldTargets.Add(field))
                        throw InvalidReview();
                    fieldMappings[field] = columnIndex;
                    break;
                case OrganizationImportSemanticKinds.OrganizationTypeMapping:
                    if (string.IsNullOrWhiteSpace(issue.SourceLabel)
                        || !targetKey.StartsWith("type:", StringComparison.Ordinal)
                        || !Guid.TryParse(targetKey["type:".Length..], out var typeId)
                        || review.TypeOptions.All(type => type.Id != typeId))
                        throw InvalidReview();
                    typeMappings[issue.SourceLabel] = typeId;
                    break;
                default:
                    throw InvalidReview();
            }

            outcomes.Add(new(item.IssueKey, suggestion.TargetKey, targetKey, item.Outcome));
        }

        var next = decisions with
        {
            Shape = selectedShape,
            FieldMappings = fieldMappings,
            TypeMappings = typeMappings,
        };
        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedSessionVersion;
        dbContext.Entry(attempt).Property(item => item.Version).OriginalValue = request.AttemptVersion;
        session.ReplaceDecisions(next, actor.Normalize());
        attempt.Apply(outcomes, actor);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            logger.LogInformation("Organization import semantic assistance apply conflicted.");
            OrganizationImportSemanticTelemetry.RecordApplyConflict();
            throw new ConcurrencyException("Organization import", sessionId);
        }
        logger.LogInformation(
            "Organization import semantic suggestions applied. Accepted={Accepted} Changed={Changed} Rejected={Rejected}",
            outcomes.Count(item => item.Outcome == OrganizationImportSemanticReviewOutcome.Accepted),
            outcomes.Count(item => item.Outcome == OrganizationImportSemanticReviewOutcome.Changed),
            outcomes.Count(item => item.Outcome == OrganizationImportSemanticReviewOutcome.Rejected));
        foreach (var outcome in outcomes) OrganizationImportSemanticTelemetry.RecordDisposition(outcome.Outcome);
        OrganizationImportSemanticTelemetry.RecordApplication();
    }

    // The provider makes two sequential calls per import (field mapping, then type mapping). The
    // second (type) call is the heavier one and is the first to be throttled or hit a transient
    // provider error — and a single failure otherwise drops the administrator straight into manual
    // type selection. A bounded retry with backoff (honouring the provider's Retry-After) lets a
    // transient throttle or blip self-heal so the interpretation completes on its own.
    private async Task<OrganizationImportSemanticProviderResult> SuggestWithRetryAsync(
        OrganizationImportSemanticRequest request,
        CancellationToken cancellationToken)
    {
        var maxAttempts = Math.Clamp(options.MaxProviderAttempts, 1, 5);
        OrganizationImportSemanticProviderException lastFailure = new(
            OrganizationImportSemanticFailureCategory.ProviderUnavailable,
            "Suggestions are unavailable right now. Continue with manual review.");
        for (var attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 1, 60)));
            try
            {
                return await provider.SuggestAsync(request, timeout.Token);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw; // The caller cancelled — surface as Interrupted upstream, do not retry.
            }
            catch (OperationCanceledException)
            {
                lastFailure = new(
                    OrganizationImportSemanticFailureCategory.Timeout,
                    "Suggestions timed out. Continue manually or retry.");
            }
            catch (OrganizationImportSemanticProviderException exception) when (IsTransient(exception.Category))
            {
                lastFailure = exception;
            }
            catch (OrganizationImportSemanticProviderException)
            {
                throw; // NotConfigured / InvalidOutput are deterministic — retrying will not help.
            }
            catch (HttpRequestException)
            {
                lastFailure = new(
                    OrganizationImportSemanticFailureCategory.ProviderUnavailable,
                    "Suggestions are unavailable right now. Continue with manual review.");
            }
            catch (Exception)
            {
                lastFailure = new(
                    OrganizationImportSemanticFailureCategory.ProviderUnavailable,
                    "Suggestions are unavailable right now. Continue with manual review.");
            }

            if (attemptNumber >= maxAttempts) break;
            var delay = RetryBackoff(attemptNumber, lastFailure.RetryAfter);
            logger.LogInformation(
                "Organization import semantic assistance retrying. Attempt={AttemptNumber} Category={Category} DelayMs={DelayMs}",
                attemptNumber,
                lastFailure.Category,
                (int)delay.TotalMilliseconds);
            if (delay > TimeSpan.Zero) await Task.Delay(delay, cancellationToken);
        }
        throw lastFailure;
    }

    private static bool IsTransient(OrganizationImportSemanticFailureCategory category)
        => category is OrganizationImportSemanticFailureCategory.RateLimited
            or OrganizationImportSemanticFailureCategory.ProviderUnavailable
            or OrganizationImportSemanticFailureCategory.Timeout;

    private static TimeSpan RetryBackoff(int attemptNumber, DateTime? retryAfter)
    {
        // Exponential 0.75s, 1.5s, 3s… floored by any provider Retry-After and capped so the overall
        // interpretation stays responsive rather than blocking on a long throttle window.
        var backoff = TimeSpan.FromMilliseconds(750 * Math.Pow(2, attemptNumber - 1));
        if (retryAfter is DateTime when)
        {
            var wait = when - DateTime.UtcNow;
            if (wait > backoff) backoff = wait;
        }
        var cap = TimeSpan.FromSeconds(10);
        if (backoff < TimeSpan.Zero) return TimeSpan.Zero;
        return backoff > cap ? cap : backoff;
    }

    private async Task<OrganizationImportSession> LoadSessionAsync(Guid sessionId, CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException("Organization import", sessionId);

    private static void EnsureActive(OrganizationImportSession session)
    {
        if (session.Status != OrganizationImportStatus.Active)
            throw new OrganizationImportReviewException(
                "ImportTerminal",
                "Only an active import can use suggestions.",
                StatusCodes.Status409Conflict);
    }

    private bool IsExpired(OrganizationImportSemanticAttempt attempt)
        => attempt.RequestedAt.AddSeconds(Math.Clamp(options.TimeoutSeconds, 1, 60) + 5) < DateTime.UtcNow;

    private async Task FailAttemptAsync(
        Guid attemptId,
        OrganizationImportSemanticFailureCategory category,
        long elapsedMilliseconds,
        DateTime? retryAfter)
    {
        dbContext.ChangeTracker.Clear();
        var attempt = await dbContext.OrganizationImportSemanticAttempts
            .SingleAsync(item => item.Id == attemptId, CancellationToken.None);
        if (attempt.Status == OrganizationImportSemanticAttemptStatus.Pending)
        {
            attempt.Fail(category, (int)Math.Min(elapsedMilliseconds, int.MaxValue), retryAfter);
            await dbContext.SaveChangesAsync(CancellationToken.None);
            logger.LogInformation(
                "Organization import semantic assistance failed. Provider={Provider} Model={Model} Category={Category} LatencyMs={LatencyMs}",
                attempt.Provider,
                attempt.Model,
                category,
                attempt.LatencyMilliseconds);
            OrganizationImportSemanticTelemetry.RecordFailure(
                attempt.Provider,
                attempt.Model,
                elapsedMilliseconds,
                category);
        }
    }

    private async Task<OrganizationImportSemanticAssistanceDto> ReloadAndMapAsync(
        Guid attemptId,
        OrganizationImportSemanticRequest request,
        CancellationToken cancellationToken)
    {
        dbContext.ChangeTracker.Clear();
        var attempt = await dbContext.OrganizationImportSemanticAttempts.AsNoTracking()
            .SingleAsync(item => item.Id == attemptId, cancellationToken);
        return Map(attempt, request);
    }

    private List<OrganizationImportSemanticProviderSuggestion> ValidateSuggestions(
        IReadOnlyList<OrganizationImportSemanticProviderSuggestion> suggestions,
        OrganizationImportSemanticRequest request)
    {
        var issues = request.Issues.ToDictionary(issue => issue.Key, StringComparer.Ordinal);
        var seenIssues = new HashSet<string>(StringComparer.Ordinal);
        var seenFieldTargets = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<OrganizationImportSemanticProviderSuggestion>();
        foreach (var suggestion in suggestions.Take(request.Issues.Count))
        {
            if (!seenIssues.Add(suggestion.IssueKey)
                || !issues.TryGetValue(suggestion.IssueKey, out var issue)
                || !string.Equals(issue.Kind, suggestion.Kind, StringComparison.Ordinal)
                || issue.AllowedTargets.All(target => target.Key != suggestion.TargetKey)
                || suggestion.Rationale?.Length > Math.Clamp(options.MaxRationaleCharacters, 40, 180))
                continue;
            if (issue.Kind == OrganizationImportSemanticKinds.FieldMapping
                && (!seenFieldTargets.Add(suggestion.TargetKey)
                    || suggestion.TargetKey == $"field:{OrganizationImportFields.FusionOrgUnitId}"))
                continue;
            result.Add(suggestion with { Rationale = string.IsNullOrWhiteSpace(suggestion.Rationale) ? null : suggestion.Rationale.Trim() });
        }
        return CorroborateTypeSystem(result, request);
    }

    /// <summary>
    /// Global coherence corroboration for organization TYPE suggestions. Structural evidence is a
    /// confidence signal, not a universal rule: a mapping is incoherent when several DISTINCT source
    /// types that the source itself differentiates by topology (different depths / parent-child roles)
    /// all collapse onto the same canonical type — most tellingly the root "Organization" reused on
    /// non-root types. Such low-confidence type suggestions are withheld so the administrator resolves
    /// them through a grouped confirmation rather than being auto-accepted into a wrong schema. Field
    /// and shape suggestions are unaffected. This never imposes a fixed level count or a root-only rule.
    /// </summary>
    private static List<OrganizationImportSemanticProviderSuggestion> CorroborateTypeSystem(
        List<OrganizationImportSemanticProviderSuggestion> suggestions,
        OrganizationImportSemanticRequest request)
    {
        var typeByLabel = request.SourceTypeSystem.ToDictionary(t => t.SourceLabel, StringComparer.OrdinalIgnoreCase);
        if (typeByLabel.Count == 0) return suggestions;
        var issues = request.Issues.ToDictionary(issue => issue.Key, StringComparer.Ordinal);
        var typeTargetLabel = request.OrganizationTypes.ToDictionary(t => $"type:{t.Id}", t => t.Name, StringComparer.Ordinal);

        // Type suggestions whose source label carries topology evidence, paired with the source type.
        var typeSuggestions = suggestions
            .Where(s => issues.TryGetValue(s.IssueKey, out var i)
                && i.Kind == OrganizationImportSemanticKinds.OrganizationTypeMapping
                && i.SourceLabel is not null && typeByLabel.ContainsKey(i.SourceLabel))
            .Select(s => (Suggestion: s, Source: typeByLabel[issues[s.IssueKey].SourceLabel!],
                Canonical: typeTargetLabel.GetValueOrDefault(s.TargetKey, s.TargetKey)))
            .ToList();
        if (typeSuggestions.Count < 2) return suggestions; // need ≥2 differentiated types to judge collapse

        var incoherent = new HashSet<string>(StringComparer.Ordinal);
        foreach (var group in typeSuggestions.GroupBy(x => Normalize(x.Canonical)))
        {
            var members = group.ToList();
            if (members.Count < 2) continue;
            // Distinct source roles collapsed to one canonical type: differentiated if they occur at
            // different depths or in a parent/child relationship to each other.
            var distinctDepthBands = members.Select(m => m.Source.MinDepth).Distinct().Count();
            var rootAndNonRoot = members.Any(m => m.Source.OccursOnRoot) && members.Any(m => !m.Source.OccursOnRoot);
            var parentChildAmongThem = members.Any(m =>
                members.Any(other => !ReferenceEquals(m, other)
                    && m.Source.ChildTypes.Contains(other.Source.SourceLabel, StringComparer.OrdinalIgnoreCase)));
            if (distinctDepthBands > 1 || rootAndNonRoot || parentChildAmongThem)
                foreach (var m in members) incoherent.Add(m.Suggestion.IssueKey);
        }
        if (incoherent.Count == 0) return suggestions;
        // Withhold only the incoherent type suggestions; everything else (including coherent types)
        // stays auto-acceptable. The withheld ones remain unresolved → grouped confirmation.
        return suggestions.Where(s => !incoherent.Contains(s.IssueKey)).ToList();
    }

    private static string Normalize(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static OrganizationImportSemanticAssistanceDto Map(
        OrganizationImportSemanticAttempt attempt,
        OrganizationImportSemanticRequest request)
    {
        var suggestions = OrganizationImportJson.Deserialize<IReadOnlyList<OrganizationImportSemanticProviderSuggestion>>(attempt.SuggestionsJson) ?? [];
        var issues = request.Issues.ToDictionary(issue => issue.Key, StringComparer.Ordinal);
        var projected = suggestions.Select(suggestion =>
        {
            if (!issues.TryGetValue(suggestion.IssueKey, out var issue)) return null;
            var target = issue.AllowedTargets.SingleOrDefault(candidate => candidate.Key == suggestion.TargetKey);
            return target is null ? null : new OrganizationImportSemanticSuggestionDto(
                suggestion.IssueKey,
                suggestion.Kind,
                issue.SourceColumnIndex,
                issue.SourceLabel,
                suggestion.TargetKey,
                target.Label,
                suggestion.Rationale,
                issue.AllowedTargets);
        }).OfType<OrganizationImportSemanticSuggestionDto>().ToList();
        var state = attempt.Status switch
        {
            OrganizationImportSemanticAttemptStatus.Pending => OrganizationImportSemanticAssistanceState.Pending,
            OrganizationImportSemanticAttemptStatus.Available => OrganizationImportSemanticAssistanceState.Available,
            OrganizationImportSemanticAttemptStatus.Failed => OrganizationImportSemanticAssistanceState.Failed,
            OrganizationImportSemanticAttemptStatus.Applied => OrganizationImportSemanticAssistanceState.Applied,
            _ => OrganizationImportSemanticAssistanceState.Eligible,
        };
        return new OrganizationImportSemanticAssistanceDto(
            state,
            request.InputFingerprint,
            attempt.Id,
            attempt.Version,
            attempt.Provider,
            attempt.Model,
            attempt.RequestedAt,
            attempt.CompletedAt,
            attempt.FailureCategory,
            attempt.RetryAfter,
            projected);
    }

    private static OrganizationImportReviewException InvalidReview()
        => new(
            "InvalidSemanticSuggestionReview",
            "The reviewed suggestions are no longer valid. Review the current set and try again.",
            StatusCodes.Status422UnprocessableEntity);

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
}
