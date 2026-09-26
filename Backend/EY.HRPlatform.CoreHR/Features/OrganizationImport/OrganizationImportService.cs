using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportService
{
    Task<OrganizationImportIntakeResult> IntakeAsync(
        Stream stream,
        string fileName,
        string? contentType,
        DateOnly effectiveDate,
        Guid creationToken,
        string? selectedSheetName,
        ImportActor actor,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<OrganizationImportActiveSummaryDto>> GetActiveAsync(CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> GetAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> ChangeEffectiveDateAsync(
        Guid sessionId,
        uint expectedVersion,
        DateOnly effectiveDate,
        ImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> DiscardAsync(
        Guid sessionId,
        uint expectedVersion,
        ImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> UpdateReviewResolutionsAsync(
        Guid sessionId,
        uint expectedVersion,
        UpdateOrganizationImportReviewResolutionsRequest request,
        ImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> UpdateMatchAsync(
        Guid sessionId,
        uint expectedVersion,
        UpdateOrganizationImportMatchRequest request,
        ImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> RefreshAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<OrganizationImportCommitResult> CommitAsync(
        Guid sessionId,
        uint expectedVersion,
        string semanticDigest,
        ImportActor actor,
        CancellationToken cancellationToken);
}

public sealed class OrganizationImportService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IOrganizationImportSourceInspectionService inspectionService,
    IOrganizationService organizationService,
    IOrganizationImportInterpreter interpreter,
    IOrganizationImportSemanticAssistanceService? semanticAssistance = null,
    IOrganizationImportPublisher? publisher = null,
    IOrganizationImportMatchReadinessService? matchReadiness = null) : IOrganizationImportService
{
    private Guid TenantId => tenantContext.TenantId;
    private readonly IOrganizationImportMatchReadinessService readinessService = matchReadiness ?? new OrganizationImportMatchReadinessService();

    public async Task<OrganizationImportIntakeResult> IntakeAsync(
        Stream stream,
        string fileName,
        string? contentType,
        DateOnly effectiveDate,
        Guid creationToken,
        string? selectedSheetName,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        if (creationToken == Guid.Empty) throw new ArgumentException("Creation token is required.");
        var inspection = await inspectionService.InspectAsync(
            stream, fileName, contentType, selectedSheetName, cancellationToken);
        if (inspection is OrganizationSheetSelectionRequired choice)
            return new OrganizationImportIntakeResult(
                OrganizationImportIntakeKind.SheetSelectionRequired, false, null, choice.Choice);

        var inspected = ((OrganizationSourceReady)inspection).Source;
        var fingerprint = CreateFingerprint(inspected);
        var existing = await LoadByCreationTokenAsync(creationToken, cancellationToken);
        if (existing is not null)
            return await ReplayOrConflictAsync(existing, fingerprint, cancellationToken);

        var normalizedActor = actor.Normalize();
        var session = OrganizationImportSession.Create(
            TenantId, effectiveDate, creationToken, fingerprint, normalizedActor);
        var source = OrganizationImportSource.Create(TenantId, session.Id, inspected);
        session.AttachSource(source);
        dbContext.OrganizationImportSessions.Add(session);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsCreationTokenConflict(exception))
        {
            dbContext.ChangeTracker.Clear();
            existing = await LoadByCreationTokenAsync(creationToken, cancellationToken);
            if (existing is null) throw;
            return await ReplayOrConflictAsync(existing, fingerprint, cancellationToken);
        }

        var initialInterpretation = await interpreter.InterpretAsync(session, cancellationToken);
        session.ApplyMappingPlan(initialInterpretation.MappingPlan
            ?? throw new InvalidOperationException("The mapping plan is unavailable."));
        await dbContext.SaveChangesAsync(cancellationToken);

        // Deterministic interpretation is saved. When it left semantic questions and the tenant
        // allows assistance, answer them now, inside a bounded budget, so Match opens populated.
        // This never decides whether the upload succeeds.
        if (semanticAssistance is not null)
        {
            await semanticAssistance.RunAfterUploadAsync(session.Id, normalizedActor, cancellationToken);
            dbContext.ChangeTracker.Clear();
            session = await LoadAsync(session.Id, cancellationToken);
        }

        return new OrganizationImportIntakeResult(
            OrganizationImportIntakeKind.SourceReady,
            false,
            await MapAsync(session, cancellationToken),
            null);
    }

    public async Task<IReadOnlyList<OrganizationImportActiveSummaryDto>> GetActiveAsync(CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions
            .AsNoTracking()
            .Where(session => session.Status == OrganizationImportStatus.Active)
            .OrderByDescending(session => session.UpdatedAt ?? session.CreatedAt)
            .Select(session => new OrganizationImportActiveSummaryDto(
                session.Id,
                session.EffectiveDate,
                session.Version,
                session.Source.OriginalFileName,
                session.Source.SourceFormat,
                session.Source.RowCount,
                session.StartedByDisplayName,
                session.LastUpdatedByDisplayName,
                session.CreatedAt,
                session.UpdatedAt))
            .Take(50)
            .ToListAsync(cancellationToken);

    public async Task<OrganizationImportSessionDto> GetAsync(Guid sessionId, CancellationToken cancellationToken)
        => await MapAsync(await LoadAsync(sessionId, cancellationToken), cancellationToken);

    public async Task<OrganizationImportSessionDto> ChangeEffectiveDateAsync(
        Guid sessionId,
        uint expectedVersion,
        DateOnly effectiveDate,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadAsync(sessionId, cancellationToken);
        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
        session.ChangeEffectiveDate(effectiveDate, actor.Normalize());
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", sessionId); }
        return await MapAsync(session, cancellationToken);
    }

    public async Task<OrganizationImportSessionDto> DiscardAsync(
        Guid sessionId,
        uint expectedVersion,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadAsync(sessionId, cancellationToken);
        if (session.Status == OrganizationImportStatus.Active)
        {
            dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
            session.Discard(actor.Normalize());
            try { await dbContext.SaveChangesAsync(cancellationToken); }
            catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", sessionId); }
        }
        return await MapAsync(session, cancellationToken);
    }

    public async Task<OrganizationImportSessionDto> UpdateReviewResolutionsAsync(
        Guid sessionId,
        uint expectedVersion,
        UpdateOrganizationImportReviewResolutionsRequest request,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadAsync(sessionId, cancellationToken);
        var current = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)?.Normalize()
            ?? new OrganizationImportDecisions().Normalize();
        var requested = (current with
        {
            IntroducedRoot = request.IntroducedRoot is { } root ? new(root.Name.Trim(), root.BusinessCode.Trim()) : null,
            AcceptedExistingMatches = request.AcceptedExistingMatches ?? new Dictionary<string, Guid>(),
            KeepExistingNodeIds = request.KeepExistingNodeIds ?? [],
        }).Normalize();
        ValidateDecisionBounds(session, requested);

        // Every resolution must answer an issue the proposal actually has without resolutions, so a
        // client cannot use this route to rewrite what the source and Mapping Plan say.
        var baseline = await interpreter.InterpretAsync(session, cancellationToken, current.WithoutReviewResolutions());
        if (!baseline.MatchReadiness.CanContinue || baseline.Validation is null)
            throw new OrganizationImportReviewException("MatchIncomplete", "Finish matching the file before reviewing the organization.", StatusCodes.Status409Conflict);
        var baselineIssues = baseline.Validation.Issues;
        if (requested.IntroducedRoot is not null
            && !baselineIssues.Any(issue => issue.Code == OrganizationImportIssueCodes.MultipleRoots))
            throw new OrganizationImportReviewException("InvalidResolution", "An organization root can only be added when the file has more than one top-level unit.");
        var baselineNodes = baseline.ProposalNodes.ToDictionary(node => node.Id, StringComparer.Ordinal);
        foreach (var (nodeId, unitId) in requested.AcceptedExistingMatches!)
            if (!baselineNodes.TryGetValue(nodeId, out var node) || node.DescriptiveCandidates.All(candidate => candidate.Id != unitId))
                throw new OrganizationImportReviewException("InvalidResolution", "That existing unit isn't a possible match for this unit.");
        var differing = baselineIssues.Where(issue => issue.Code == OrganizationImportIssueCodes.ExistingDifference)
            .Select(issue => issue.ProposalNodeId).OfType<string>().ToHashSet(StringComparer.Ordinal);
        foreach (var nodeId in requested.KeepExistingNodeIds!)
            if (!differing.Contains(nodeId) && !requested.AcceptedExistingMatches.ContainsKey(nodeId))
                throw new OrganizationImportReviewException("InvalidResolution", "Only a unit that differs from an existing unit can keep the existing version.");

        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
        session.ReplaceDecisions(requested, actor.Normalize());
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", sessionId); }
        return await MapAsync(session, cancellationToken);
    }

    public async Task<OrganizationImportSessionDto> UpdateMatchAsync(
        Guid sessionId,
        uint expectedVersion,
        UpdateOrganizationImportMatchRequest request,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadAsync(sessionId, cancellationToken);
        var current = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)?.Normalize()
            ?? new OrganizationImportDecisions().Normalize();
        var fields = new Dictionary<string, int?>(current.FieldMappings!, StringComparer.Ordinal);
        var fieldOrigins = new Dictionary<string, ImportResolutionOrigin>(current.FieldMappingOrigins!, StringComparer.Ordinal);
        var types = new Dictionary<string, Guid>(current.TypeMappings!, StringComparer.OrdinalIgnoreCase);
        var typeOrigins = new Dictionary<string, ImportResolutionOrigin>(current.TypeMappingOrigins!, StringComparer.OrdinalIgnoreCase);
        // Every choice made here is the administrator's. Changing a mapping that semantic assistance
        // supplied is an override, counted against the run that supplied it.
        var overrides = 0;
        foreach (var item in request.FieldMappings ?? new Dictionary<string, int?>())
        {
            if (fields.TryGetValue(item.Key, out var previous) && previous == item.Value) continue;
            if (fieldOrigins.GetValueOrDefault(item.Key) == ImportResolutionOrigin.SemanticSuggestion) overrides++;
            fields[item.Key] = item.Value;
            fieldOrigins[item.Key] = ImportResolutionOrigin.Administrator;
        }
        foreach (var item in request.TypeMappings ?? new Dictionary<string, Guid>())
        {
            if (types.TryGetValue(item.Key, out var previous) && previous == item.Value) continue;
            if (typeOrigins.GetValueOrDefault(item.Key) == ImportResolutionOrigin.SemanticSuggestion) overrides++;
            types[item.Key] = item.Value;
            typeOrigins[item.Key] = ImportResolutionOrigin.Administrator;
        }
        var shapeChanged = request.Shape is not null && request.Shape != current.Shape;
        if (shapeChanged && current.ShapeDecisionOrigin == ImportResolutionOrigin.SemanticSuggestion) overrides++;
        var shapeOrigin = shapeChanged ? ImportResolutionOrigin.Administrator : current.ShapeDecisionOrigin;
        var next = current with
        {
            Shape = request.Shape ?? current.Shape,
            ShapeDecisionOrigin = shapeOrigin,
            FieldMappings = fields,
            FieldMappingOrigins = fieldOrigins,
            TypeMappings = types,
            TypeMappingOrigins = typeOrigins,
            IdentityStrategy = request.IdentityStrategy ?? current.IdentityStrategy,
        };
        ValidateDecisionBounds(session, next);
        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
        session.ReplaceDecisions(next, actor.Normalize());
        if (semanticAssistance is not null)
            await semanticAssistance.RecordOverridesAsync(sessionId, overrides, cancellationToken);
        var interpretation = await interpreter.InterpretAsync(session, cancellationToken);
        session.ApplyMappingPlan(interpretation.MappingPlan
            ?? throw new InvalidOperationException("The mapping plan is unavailable."));
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", sessionId); }
        return await MapAsync(session, cancellationToken);
    }

    public Task<OrganizationImportSessionDto> RefreshAsync(Guid sessionId, CancellationToken cancellationToken)
        => GetAsync(sessionId, cancellationToken);

    public async Task<OrganizationImportCommitResult> CommitAsync(
        Guid sessionId,
        uint expectedVersion,
        string proposalFingerprint,
        ImportActor actor,
        CancellationToken cancellationToken)
        => await (publisher ?? new OrganizationImportPublisher(dbContext, tenantContext, organizationService, interpreter))
            .PublishAsync(sessionId, expectedVersion, proposalFingerprint, actor, cancellationToken);

    private async Task<OrganizationImportIntakeResult> ReplayOrConflictAsync(
        OrganizationImportSession existing,
        string fingerprint,
        CancellationToken cancellationToken)
    {
        if (!ImportFingerprint.Matches(existing.CreationFingerprint, fingerprint))
            throw new OrganizationImportSourceException(
                "IdempotencyConflict",
                "This upload token is already associated with a different source.",
                StatusCodes.Status409Conflict);
        return new OrganizationImportIntakeResult(
            OrganizationImportIntakeKind.SourceReady,
            true,
            await MapAsync(existing, cancellationToken),
            null);
    }

    private async Task<OrganizationImportSession> LoadAsync(Guid sessionId, CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException("Organization import", sessionId);

    private async Task<OrganizationImportSession?> LoadByCreationTokenAsync(Guid token, CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions
            .Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.CreationToken == token, cancellationToken);

    private async Task<OrganizationImportSessionDto> MapAsync(
        OrganizationImportSession session,
        CancellationToken cancellationToken)
    {
        var readiness = await organizationService.GetReadinessAsync(cancellationToken);
        var hierarchy = await organizationService.GetHierarchyAsync(session.EffectiveDate, cancellationToken);
        var baseline = new CanonicalOrganizationBaselineSummary(
            readiness.HasPermanentRoot,
            hierarchy.Roots.Count > 0);
        var table = session.Status == OrganizationImportStatus.Active
            ? OrganizationImportJson.Deserialize(session.Source.SourceTableJson)
            : null;
        var interpretation = session.Status == OrganizationImportStatus.Active
            ? await interpreter.InterpretAsync(session, cancellationToken)
            : null;
        var commitResult = session.Status == OrganizationImportStatus.Committed
            ? OrganizationImportJson.Deserialize<OrganizationImportCommitResult>(session.CommitResultJson)
            : null;
        var assistance = session.Status == OrganizationImportStatus.Active && interpretation is not null && semanticAssistance is not null
            ? await semanticAssistance.DescribeAsync(session, interpretation, cancellationToken)
            : null;
        var plan = interpretation?.MappingPlan;
        var matchReadiness = plan is null ? null : readinessService.Evaluate(plan);
        var match = plan is null || matchReadiness is null ? null : new OrganizationImportMatchDto(
            plan,
            matchReadiness,
            readinessService.CompletionKind(plan, matchReadiness),
            interpretation!.TypeOptions,
            assistance);
        var review = interpretation is null ? null : OrganizationImportReviewProjection.Create(
            interpretation,
            OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)?.Normalize() ?? new OrganizationImportDecisions().Normalize(),
            session.DecisionRevision);
        return new OrganizationImportSessionDto(
            session.Id,
            session.Status.ToString(),
            session.EffectiveDate,
            session.Version,
            session.StartedByUserId,
            session.StartedByDisplayName,
            session.LastUpdatedByUserId,
            session.LastUpdatedByDisplayName,
            session.CreatedAt,
            session.UpdatedAt,
            session.DiscardedAt,
            new OrganizationImportSourceDto(
                session.Source.OriginalFileName,
                session.Source.SourceFormat,
                session.Source.ContentType,
                session.Source.ByteLength,
                session.Source.Sha256,
                session.Source.SelectedSheetName,
                session.Source.SelectedRange,
                session.Source.ColumnCount,
                session.Source.RowCount,
                session.Source.PayloadPurgedAt,
                table),
            baseline,
            OrganizationImportJson.Deserialize<OrganizationImportDecisions>(session.DecisionsJson)?.Normalize() ?? new OrganizationImportDecisions().Normalize(),
            review,
            commitResult,
            session.CommittedAt,
            session.CommittedByUserId,
            session.CommittedByDisplayName,
            session.Status == OrganizationImportStatus.Committed
                ? OrganizationImportJson.Deserialize<IReadOnlyList<OrganizationImportProvenance>>(session.FinalProvenanceJson)
                : null,
            assistance,
            match);
    }

    private static string CreateFingerprint(InspectedOrganizationSource source)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{source.Sha256}\n{source.SelectedSheetName}\n{source.SelectedRange}")));

    private static bool IsCreationTokenConflict(DbUpdateException exception)
        => exception.InnerException is PostgresException postgres
            && postgres.SqlState == PostgresErrorCodes.UniqueViolation
            && postgres.ConstraintName == "UX_OrganizationImportSessions_Tenant_CreationToken";

    private static void ValidateDecisionBounds(OrganizationImportSession session, OrganizationImportDecisions value)
    {
        var decisions = value.Normalize();
        var allowedFields = new HashSet<string>(
            [OrganizationImportFields.FusionOrgUnitId, OrganizationImportFields.BusinessCode, OrganizationImportFields.Name,
             OrganizationImportFields.Type, OrganizationImportFields.ParentBusinessCode], StringComparer.Ordinal);
        if (decisions.FieldMappings!.Any(item => !allowedFields.Contains(item.Key)
                || item.Value is int column && (column < 0 || column >= session.Source.ColumnCount)))
            throw new OrganizationImportReviewException("InvalidDecision", "A field mapping does not belong to this source.");
        if (decisions.FieldMappingOrigins!.Keys.Any(key => !allowedFields.Contains(key))
            || decisions.TypeMappingOrigins!.Keys.Any(key => !decisions.TypeMappings!.ContainsKey(key)))
            throw new OrganizationImportReviewException("InvalidDecision", "Mapping provenance does not belong to this source interpretation.");
        if (decisions.FieldMappings!.Values.Where(column => column is not null).Select(column => column!.Value)
            .GroupBy(column => column).Any(group => group.Count() > 1))
            throw new OrganizationImportReviewException("InvalidDecision", "A source column can only satisfy one organization role.");
        if (decisions.TypeMappings!.Count > 256 || decisions.AcceptedExistingMatches!.Count > session.Source.RowCount
            || decisions.KeepExistingNodeIds!.Count > session.Source.RowCount * Math.Max(1, session.Source.ColumnCount))
            throw new OrganizationImportReviewException("DecisionLimitExceeded", "The proposal contains too many decisions.");
        if (decisions.TypeMappings.Keys.Any(key => key.Length > 200)
            || decisions.AcceptedExistingMatches.Keys.Concat(decisions.KeepExistingNodeIds).Any(key => key.Length > 128))
            throw new OrganizationImportReviewException("InvalidDecision", "A proposal decision is invalid.");
        if (decisions.IntroducedRoot is { } root
            && (string.IsNullOrWhiteSpace(root.Name) || root.Name.Trim().Length > 200
                || string.IsNullOrWhiteSpace(root.BusinessCode) || root.BusinessCode.Trim().Length > 50))
            throw new OrganizationImportReviewException("InvalidDecision", "The proposed Organization root needs a valid Name and Business Code.");
        if (Encoding.UTF8.GetByteCount(OrganizationImportJson.Serialize(decisions)) > 512 * 1024)
            throw new OrganizationImportReviewException("DecisionLimitExceeded", "The proposal decisions are too large.");
    }
}
