using System.Diagnostics;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;

/// <summary>Time limits for semantic runs. Upload runs wait inside the upload; interactive runs are started from Match.</summary>
public sealed record ImportSemanticBudget(TimeSpan Upload, TimeSpan Interactive, TimeSpan CallTimeout, int MaxRetries)
{
    public static ImportSemanticBudget From(int uploadSeconds, int interactiveSeconds, int timeoutSeconds, int maxRetries)
        => new(
            TimeSpan.FromSeconds(Math.Clamp(uploadSeconds, 1, 60)),
            TimeSpan.FromSeconds(Math.Clamp(interactiveSeconds, 1, 90)),
            TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 1, 60)),
            Math.Clamp(maxRetries, 0, 2));
}

/// <summary>
/// One semantic run as the domain describes it. The runner owns how it runs; the domain owns what
/// is asked (<see cref="CallProvider"/>) and what an answer means against the import as it is now
/// (<see cref="ApplyToCurrent"/>, which returns null when the import changed under the run).
/// </summary>
public sealed record ImportSemanticRun<TAttempt>(
    Guid SessionId,
    string InputFingerprint,
    int QuestionCount,
    string ResultContractVersion,
    string DataContractVersion,
    string PromptVersion,
    string Provider,
    string Model,
    ImportSemanticTrigger Trigger,
    TimeSpan Budget,
    Func<int, TAttempt> StartAttempt,
    Func<CancellationToken, Task<ImportSemanticProviderResult>> CallProvider,
    Func<ImportSemanticProviderResult, CancellationToken, Task<ImportSemanticRunOutcome?>> ApplyToCurrent)
    where TAttempt : ImportSemanticAttempt;

/// <summary>
/// The shared reliability machinery for semantic assistance: attempt claim, reuse of an identical
/// earlier result, bounded retries inside a budget, staleness, and outcome recording. It never
/// interprets questions or answers; each import domain supplies that through <see cref="ImportSemanticRun{TAttempt}"/>.
/// </summary>
public sealed class ImportSemanticRunner(
    CoreHRDbContext dbContext,
    ImportSemanticBudget budget,
    ImportSemanticTelemetry telemetry,
    string attemptClaimConstraint,
    ILogger logger,
    TimeProvider? timeProvider = null)
{
    private readonly TimeProvider clock = timeProvider ?? TimeProvider.System;

    public TimeSpan InteractiveBudget => budget.Interactive;
    public TimeSpan UploadBudget => budget.Upload;

    /// <summary>The most recent run for an import that still describes it.</summary>
    public static Task<TAttempt?> LatestAsync<TAttempt>(IQueryable<TAttempt> attempts, Guid sessionId, CancellationToken cancellationToken)
        where TAttempt : ImportSemanticAttempt
        => attempts.AsNoTracking()
            .Where(item => item.SessionId == sessionId && item.Status != ImportSemanticAttemptStatus.Stale)
            .OrderByDescending(item => item.AttemptOrdinal)
            .FirstOrDefaultAsync(cancellationToken);

    /// <summary>
    /// Product-level state from the latest run and the questions open now. A successful run becomes
    /// stale only when questions appear that it was never asked; abstentions are its honest result.
    /// </summary>
    public ImportSemanticAssistanceDto Describe(
        ImportSemanticAttempt? latest,
        string? inputFingerprint,
        IReadOnlyCollection<string>? openQuestionKeys,
        bool exceedsPayloadBudget,
        bool available,
        bool hasConsent,
        ImportSemanticConsentScope consentScope)
    {
        var remaining = openQuestionKeys?.Count ?? 0;
        if (latest is null)
        {
            if (openQuestionKeys is null)
                return ImportSemanticAssistanceDto.Of(
                    exceedsPayloadBudget ? ImportSemanticAssistanceState.Skipped : ImportSemanticAssistanceState.NotNeeded, null, 0);
            if (!available)
                return ImportSemanticAssistanceDto.Of(ImportSemanticAssistanceState.Skipped, null, remaining);
            if (!hasConsent)
                return ImportSemanticAssistanceDto.Of(ImportSemanticAssistanceState.AwaitingConsent, inputFingerprint, remaining)
                    with { ConsentScope = consentScope };
            return ImportSemanticAssistanceDto.Of(ImportSemanticAssistanceState.Ready, inputFingerprint, remaining)
                with { CanRetry = true };
        }

        var runnable = openQuestionKeys is not null && available;
        if (latest.Status == ImportSemanticAttemptStatus.Running)
        {
            var abandoned = latest.IsAbandoned(budget.Interactive);
            return Contribution(latest, inputFingerprint, remaining) with
            {
                State = abandoned ? ImportSemanticAssistanceState.Failed : ImportSemanticAssistanceState.Running,
                FailureCategory = abandoned ? ImportSemanticFailureCategory.Interrupted : null,
                CanRetry = abandoned && runnable,
            };
        }

        if (latest.Status == ImportSemanticAttemptStatus.Failed)
        {
            var retryAllowed = runnable
                && latest.FailureCategory is { } category && ImportSemanticFailures.IsTransient(category)
                && (latest.RetryAfter is null || latest.RetryAfter <= clock.GetUtcNow().UtcDateTime);
            return Contribution(latest, inputFingerprint, remaining) with
            {
                State = ImportSemanticAssistanceState.Failed,
                CanRetry = retryAllowed,
            };
        }

        var asked = latest.QuestionKeys().ToHashSet(StringComparer.Ordinal);
        var hasNewQuestions = openQuestionKeys is not null && openQuestionKeys.Any(key => !asked.Contains(key));
        return Contribution(latest, inputFingerprint, remaining) with
        {
            State = hasNewQuestions && runnable ? ImportSemanticAssistanceState.Stale : ImportSemanticAssistanceState.Succeeded,
            CanRetry = hasNewQuestions && runnable,
        };
    }

    /// <summary>
    /// Whether an administrator-started run should call the provider now. A live run, a successful run
    /// that already covers every open question, or a rate-limit window means no new call.
    /// </summary>
    public bool ShouldStartInteractive(ImportSemanticAttempt? latest, IReadOnlyCollection<string> openQuestionKeys, out bool rateLimited)
    {
        rateLimited = false;
        if (latest is { Status: ImportSemanticAttemptStatus.Running } && !latest.IsAbandoned(budget.Interactive)) return false;
        if (latest is { Status: ImportSemanticAttemptStatus.Succeeded }
            && openQuestionKeys.All(key => latest.QuestionKeys().Contains(key))) return false;
        if (latest is { Status: ImportSemanticAttemptStatus.Failed, RetryAfter: { } retryAfter }
            && retryAfter > clock.GetUtcNow().UtcDateTime)
        {
            rateLimited = true;
            return false;
        }
        return true;
    }

    public async Task RunAsync<TAttempt>(DbSet<TAttempt> attempts, ImportSemanticRun<TAttempt> run, CancellationToken cancellationToken)
        where TAttempt : ImportSemanticAttempt
    {
        var existing = await attempts.Where(item => item.SessionId == run.SessionId).ToListAsync(cancellationToken);
        foreach (var abandoned in existing.Where(item => item.IsAbandoned(budget.Interactive)))
            abandoned.Fail(ImportSemanticFailureCategory.Interrupted, 0, 0, diagnosticCode: "RunAbandoned");

        var attempt = run.StartAttempt(existing.Count == 0 ? 1 : existing.Max(item => item.AttemptOrdinal) + 1);
        attempts.Add(attempt);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsClaimConflict(exception))
        {
            // A concurrent request claimed this run; its outcome will be the one described.
            dbContext.ChangeTracker.Clear();
            return;
        }

        telemetry.RecordRun(run.Provider, run.Model, run.Trigger, run.QuestionCount);
        logger.LogInformation(
            "Import semantic assistance started. Trigger={Trigger} Provider={Provider} Model={Model} PromptVersion={PromptVersion} Questions={Questions} AttemptOrdinal={AttemptOrdinal}",
            run.Trigger, run.Provider, run.Model, run.PromptVersion, run.QuestionCount, attempt.AttemptOrdinal);

        var stopwatch = Stopwatch.StartNew();
        var reused = await FindReusableAsync(attempts, run, cancellationToken);
        ImportSemanticProviderResult providerResult;
        var retries = 0;
        if (reused is not null)
        {
            providerResult = new ImportSemanticProviderResult(
                reused.AppliedSuggestions()
                    .Select(item => new ImportSemanticAnswer(item.QuestionKey, ImportSemanticDisposition.Suggest, item.TargetKey))
                    .ToList(),
                null, null);
            telemetry.RecordReuse();
        }
        else
        {
            try
            {
                (providerResult, retries) = await CallWithRetriesAsync(run, stopwatch, cancellationToken);
            }
            catch (RetriesExhausted exception)
            {
                await FinishAsync(attempts, attempt.Id, running => running.Fail(
                    exception.Category, Elapsed(stopwatch), exception.Retries, exception.RetryAfter, DiagnosticFor(exception.Category)));
                telemetry.RecordFailure(run.Provider, run.Model, stopwatch.Elapsed.TotalMilliseconds, exception.Category);
                logger.LogInformation(
                    "Import semantic assistance failed. Category={Category} LatencyMs={LatencyMs}", exception.Category, Elapsed(stopwatch));
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                await FinishAsync(attempts, attempt.Id, running => running.Fail(
                    ImportSemanticFailureCategory.Interrupted, Elapsed(stopwatch), retries, diagnosticCode: "RequestInterrupted"));
                throw;
            }
        }

        // The provider answered for the import as it was. Apply only against the import as it is now.
        dbContext.ChangeTracker.Clear();
        var outcome = await run.ApplyToCurrent(providerResult, cancellationToken);
        var persisted = await attempts.SingleAsync(item => item.Id == attempt.Id, cancellationToken);
        if (outcome is null)
        {
            persisted.MarkStale();
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Import semantic result is stale and was not applied. AttemptOrdinal={AttemptOrdinal}", persisted.AttemptOrdinal);
            return;
        }

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
            await FinishAsync(attempts, attempt.Id, running => running.MarkStale());
            return;
        }

        telemetry.RecordSuccess(run.Provider, run.Model, stopwatch.Elapsed.TotalMilliseconds, outcome, retries, reused is not null);
        logger.LogInformation(
            "Import semantic assistance succeeded. Questions={Questions} Returned={Returned} Accepted={Accepted} Rejected={Rejected} Applied={Applied} Abstentions={Abstentions} Retries={Retries} Reused={Reused} LatencyMs={LatencyMs}",
            run.QuestionCount, outcome.Returned, outcome.Accepted, outcome.Rejected, outcome.Applied.Count, outcome.Abstentions,
            retries, reused is not null, Elapsed(stopwatch));
    }

    /// <summary>
    /// One call plus at most <see cref="ImportSemanticBudget.MaxRetries"/> retries for transient
    /// failures, with exponential backoff and jitter, all inside the run's budget. Credential and
    /// configuration failures are never retried; an unfinished budget ends the run as a timeout.
    /// </summary>
    private async Task<(ImportSemanticProviderResult Result, int Retries)> CallWithRetriesAsync<TAttempt>(
        ImportSemanticRun<TAttempt> run,
        Stopwatch stopwatch,
        CancellationToken cancellationToken)
        where TAttempt : ImportSemanticAttempt
    {
        var retries = 0;
        while (true)
        {
            var remaining = run.Budget - stopwatch.Elapsed;
            if (remaining <= TimeSpan.FromMilliseconds(250))
                throw new RetriesExhausted(ImportSemanticFailureCategory.Timeout, null, retries);
            using var call = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            call.CancelAfter(remaining < budget.CallTimeout ? remaining : budget.CallTimeout);
            ImportSemanticProviderException failure;
            try
            {
                return (await run.CallProvider(call.Token), retries);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (OperationCanceledException) { failure = new(ImportSemanticFailureCategory.Timeout, "Timed out."); }
            catch (HttpRequestException) { failure = new(ImportSemanticFailureCategory.ProviderUnavailable, "Unavailable."); }
            catch (ImportSemanticProviderException exception) { failure = exception; }
            catch (Exception) { failure = new(ImportSemanticFailureCategory.ProviderUnavailable, "Unavailable."); }

            if (!failure.Retryable || retries >= budget.MaxRetries)
                throw new RetriesExhausted(failure.Category, failure.RetryAfter, retries);
            var delay = TimeSpan.FromMilliseconds(400 * Math.Pow(2, retries) + Random.Shared.Next(0, 250));
            if (failure.RetryAfter is { } retryAfter && retryAfter - clock.GetUtcNow().UtcDateTime is var wait && wait > delay)
                delay = wait;
            if (stopwatch.Elapsed + delay + TimeSpan.FromSeconds(1) >= run.Budget)
                throw new RetriesExhausted(failure.Category, failure.RetryAfter, retries);
            telemetry.RecordRetry(run.Provider, run.Model, failure.Category);
            await Task.Delay(delay, clock, cancellationToken);
            retries++;
        }
    }

    /// <summary>
    /// A successful earlier run on the identical input, under the same prompt, result and data
    /// contracts, provider and model. Refreshing or re-uploading the same file reuses it.
    /// </summary>
    private static Task<TAttempt?> FindReusableAsync<TAttempt>(
        DbSet<TAttempt> attempts,
        ImportSemanticRun<TAttempt> run,
        CancellationToken cancellationToken)
        where TAttempt : ImportSemanticAttempt
        => attempts.AsNoTracking()
            .Where(item => item.InputFingerprint == run.InputFingerprint
                && item.Status == ImportSemanticAttemptStatus.Succeeded
                && item.ReusedFromAttemptId == null
                && item.PromptVersion == run.PromptVersion
                && item.ResultContractVersion == run.ResultContractVersion
                && item.DataContractVersion == run.DataContractVersion
                && item.Provider == run.Provider
                && item.Model == run.Model)
            .OrderByDescending(item => item.CompletedAt)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task FinishAsync<TAttempt>(DbSet<TAttempt> attempts, Guid attemptId, Action<TAttempt> finish)
        where TAttempt : ImportSemanticAttempt
    {
        dbContext.ChangeTracker.Clear();
        var attempt = await attempts.SingleAsync(item => item.Id == attemptId, CancellationToken.None);
        if (attempt.Status != ImportSemanticAttemptStatus.Running) return;
        finish(attempt);
        await dbContext.SaveChangesAsync(CancellationToken.None);
    }

    private static ImportSemanticAssistanceDto Contribution(ImportSemanticAttempt attempt, string? inputFingerprint, int remaining)
        => new(
            ImportSemanticAssistanceState.Succeeded,
            inputFingerprint,
            attempt.QuestionsSubmitted,
            attempt.SuggestionsApplied,
            attempt.Abstentions,
            remaining,
            attempt.CompletedAt,
            false,
            attempt.Status == ImportSemanticAttemptStatus.Failed ? attempt.RetryAfter : null,
            attempt.Status == ImportSemanticAttemptStatus.Failed ? attempt.FailureCategory : null);

    private static string DiagnosticFor(ImportSemanticFailureCategory category) => category switch
    {
        ImportSemanticFailureCategory.InvalidOutput => "ProviderResponseInvalid",
        ImportSemanticFailureCategory.Timeout => "BudgetOrCallTimeout",
        _ => "ProviderRequestFailed",
    };

    private static int Elapsed(Stopwatch stopwatch) => (int)Math.Min(stopwatch.ElapsedMilliseconds, int.MaxValue);

    private bool IsClaimConflict(DbUpdateException exception)
        => exception.InnerException is PostgresException postgres
            && postgres.SqlState == PostgresErrorCodes.UniqueViolation
            && postgres.ConstraintName == attemptClaimConstraint;

    /// <summary>The final failure of a run, carrying how many retries were spent reaching it.</summary>
    private sealed class RetriesExhausted(ImportSemanticFailureCategory category, DateTime? retryAfter, int retries)
        : Exception("Automatic matching could not complete.")
    {
        public ImportSemanticFailureCategory Category { get; } = category;
        public DateTime? RetryAfter { get; } = retryAfter;
        public int Retries { get; } = retries;
    }
}

/// <summary>
/// Whether external semantic processing is allowed. Consent binds to tenant + provider + the domain's
/// data contract version, never to a model; each import domain has its own data contract, so one
/// domain's consent never covers another's data.
/// </summary>
public static class ImportSemanticConsentPolicy
{
    public static ImportSemanticConsentScope ScopeOf(ImportSemanticConsentMode mode)
        => mode == ImportSemanticConsentMode.PerImport ? ImportSemanticConsentScope.Import : ImportSemanticConsentScope.Tenant;

    public static Task<bool> HasConsentAsync(
        CoreHRDbContext dbContext,
        ImportSemanticConsentMode mode,
        string provider,
        string dataContractVersion,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        if (mode == ImportSemanticConsentMode.Implicit) return Task.FromResult(true);
        Guid? scope = mode == ImportSemanticConsentMode.PerImport ? sessionId : null;
        return dbContext.ImportSemanticConsents.AnyAsync(consent =>
            consent.Provider == provider
            && consent.DataContractVersion == dataContractVersion
            && consent.SessionId == scope
            && consent.RevokedAt == null, cancellationToken);
    }

    /// <summary>Records consent; a concurrent grant of the same consent is treated as success.</summary>
    public static async Task GrantAsync(
        CoreHRDbContext dbContext,
        Guid tenantId,
        ImportSemanticConsentMode mode,
        string provider,
        string dataContractVersion,
        ImportActor actor,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        dbContext.ImportSemanticConsents.Add(ImportSemanticConsent.Grant(
            tenantId, provider, dataContractVersion, actor, mode == ImportSemanticConsentMode.PerImport ? sessionId : null));
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { dbContext.ChangeTracker.Clear(); }
    }
}
