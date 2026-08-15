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
        OrganizationImportActor actor,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<OrganizationImportActiveSummaryDto>> GetActiveAsync(CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> GetAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> ChangeEffectiveDateAsync(
        Guid sessionId,
        uint expectedVersion,
        DateOnly effectiveDate,
        OrganizationImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> DiscardAsync(
        Guid sessionId,
        uint expectedVersion,
        OrganizationImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> ReplaceDecisionsAsync(
        Guid sessionId,
        uint expectedVersion,
        OrganizationImportDecisions decisions,
        OrganizationImportActor actor,
        CancellationToken cancellationToken);
    Task<OrganizationImportSessionDto> RefreshAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<OrganizationImportCommitResult> CommitAsync(
        Guid sessionId,
        uint expectedVersion,
        string semanticDigest,
        OrganizationImportActor actor,
        CancellationToken cancellationToken);
}

public sealed class OrganizationImportService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IOrganizationImportSourceInspectionService inspectionService,
    IOrganizationService organizationService,
    IOrganizationImportInterpreter interpreter,
    IOrganizationImportSemanticAssistanceService? semanticAssistance = null) : IOrganizationImportService
{
    private Guid TenantId => tenantContext.TenantId;

    public async Task<OrganizationImportIntakeResult> IntakeAsync(
        Stream stream,
        string fileName,
        string? contentType,
        DateOnly effectiveDate,
        Guid creationToken,
        string? selectedSheetName,
        OrganizationImportActor actor,
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
        OrganizationImportActor actor,
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
        OrganizationImportActor actor,
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

    public async Task<OrganizationImportSessionDto> ReplaceDecisionsAsync(
        Guid sessionId,
        uint expectedVersion,
        OrganizationImportDecisions decisions,
        OrganizationImportActor actor,
        CancellationToken cancellationToken)
    {
        var session = await LoadAsync(sessionId, cancellationToken);
        ValidateDecisionBounds(session, decisions);
        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
        session.ReplaceDecisions(decisions, actor.Normalize());
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", sessionId); }
        return await MapAsync(session, cancellationToken);
    }

    public Task<OrganizationImportSessionDto> RefreshAsync(Guid sessionId, CancellationToken cancellationToken)
        => GetAsync(sessionId, cancellationToken);

    public async Task<OrganizationImportCommitResult> CommitAsync(
        Guid sessionId,
        uint expectedVersion,
        string semanticDigest,
        OrganizationImportActor actor,
        CancellationToken cancellationToken)
    {
        var initiallyLoaded = await LoadAsync(sessionId, cancellationToken);
        if (initiallyLoaded.Status == OrganizationImportStatus.Committed)
            return OrganizationImportJson.Deserialize<OrganizationImportCommitResult>(initiallyLoaded.CommitResultJson)
                ?? throw new InvalidOperationException("The committed import result is unavailable.");
        if (initiallyLoaded.Status != OrganizationImportStatus.Active)
            throw new OrganizationImportReviewException("ImportTerminal", "A discarded import cannot be completed.", StatusCodes.Status409Conflict);
        dbContext.ChangeTracker.Clear();

        await using var transaction = await OrganizationWriteTransaction.BeginAsync(dbContext, TenantId, cancellationToken);
        var session = await LoadAsync(sessionId, cancellationToken);
        if (session.Status == OrganizationImportStatus.Committed)
            return OrganizationImportJson.Deserialize<OrganizationImportCommitResult>(session.CommitResultJson)
                ?? throw new InvalidOperationException("The committed import result is unavailable.");
        if (session.Status != OrganizationImportStatus.Active)
            throw new OrganizationImportReviewException("ImportTerminal", "A discarded import cannot be completed.", StatusCodes.Status409Conflict);
        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
        var review = await interpreter.InterpretAsync(session, cancellationToken);
        if (!review.CanCommit)
            throw new OrganizationImportReviewException("ProposalBlocked", "Resolve every blocking issue before completing the import.", StatusCodes.Status409Conflict);
        if (string.IsNullOrWhiteSpace(semanticDigest)
            || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(review.SemanticDigest), Encoding.ASCII.GetBytes(semanticDigest.Trim())))
            throw new OrganizationImportReviewException("ProposalChanged", "The Organization proposal changed. Review the refreshed result before completing it.", StatusCodes.Status409Conflict);

        var createNodes = review.ProposalNodes
            .Where(node => node.Classification == OrganizationImportNodeClassification.Create)
            .Select(node => new OrganizationBatchCreateNode(node.Id, node.BusinessCode!, node.Name, node.TypeId!.Value,
                node.ParentNodeId, node.ParentCanonicalId, node.IsProposalRoot))
            .ToList();
        var created = await organizationService.CreateBatchInCurrentTransactionAsync(session.EffectiveDate, createNodes, cancellationToken);
        var result = new OrganizationImportCommitResult(session.Id, session.EffectiveDate,
            created.Select(node => new OrganizationImportCreatedUnit(node.ProposalNodeId, node.OrgUnitId, node.Code, node.Name)).ToList(),
            created.Count == 0);
        var createdByProposal = created.ToDictionary(node => node.ProposalNodeId, StringComparer.Ordinal);
        var provenance = review.ProposalNodes.Select(node => new OrganizationImportProvenance(
            node.Id,
            node.CanonicalId ?? (createdByProposal.TryGetValue(node.Id, out var item) ? item.OrgUnitId : null),
            node.SourceCells,
            node.Classification.ToString())).ToList();
        session.Commit(review.SemanticDigest, result, provenance, actor.Normalize());
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", sessionId); }
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return result;
    }

    private async Task<OrganizationImportIntakeResult> ReplayOrConflictAsync(
        OrganizationImportSession existing,
        string fingerprint,
        CancellationToken cancellationToken)
    {
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(existing.CreationFingerprint),
                Encoding.ASCII.GetBytes(fingerprint)))
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
        var review = session.Status == OrganizationImportStatus.Active
            ? await interpreter.InterpretAsync(session, cancellationToken)
            : null;
        var commitResult = session.Status == OrganizationImportStatus.Committed
            ? OrganizationImportJson.Deserialize<OrganizationImportCommitResult>(session.CommitResultJson)
            : null;
        var assistance = session.Status == OrganizationImportStatus.Active && review is not null && semanticAssistance is not null
            ? await semanticAssistance.DescribeAsync(session, review, cancellationToken)
            : null;
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
            assistance);
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
        if (decisions.TypeMappings!.Count > 256 || decisions.AcceptedExistingMatches!.Count > session.Source.RowCount
            || decisions.NodeCorrections!.Count > session.Source.RowCount * Math.Max(1, session.Source.ColumnCount)
            || decisions.ExcludedNodeIds!.Count > session.Source.RowCount * Math.Max(1, session.Source.ColumnCount)
            || decisions.KeepCanonicalNodeIds!.Count > session.Source.RowCount * Math.Max(1, session.Source.ColumnCount))
            throw new OrganizationImportReviewException("DecisionLimitExceeded", "The proposal contains too many decisions.");
        if (decisions.TypeMappings.Keys.Any(key => key.Length > 200)
            || decisions.AcceptedExistingMatches.Keys.Concat(decisions.NodeCorrections.Keys)
                .Concat(decisions.ExcludedNodeIds).Concat(decisions.KeepCanonicalNodeIds).Any(key => key.Length > 128))
            throw new OrganizationImportReviewException("InvalidDecision", "A proposal decision is invalid.");
        if (decisions.NodeCorrections.Values.Any(correction =>
                correction.Name?.Trim().Length > 200 || correction.BusinessCode?.Trim().Length > 50
                || correction.ParentNodeId?.Length > 128))
            throw new OrganizationImportReviewException("InvalidDecision", "A proposed unit correction exceeds Organization limits.");
        if (decisions.IntroducedRoot is { } root
            && (string.IsNullOrWhiteSpace(root.Name) || root.Name.Trim().Length > 200
                || string.IsNullOrWhiteSpace(root.BusinessCode) || root.BusinessCode.Trim().Length > 50))
            throw new OrganizationImportReviewException("InvalidDecision", "The proposed Organization root needs a valid Name and Business Code.");
        if (Encoding.UTF8.GetByteCount(OrganizationImportJson.Serialize(decisions)) > 512 * 1024)
            throw new OrganizationImportReviewException("DecisionLimitExceeded", "The proposal decisions are too large.");
    }
}
