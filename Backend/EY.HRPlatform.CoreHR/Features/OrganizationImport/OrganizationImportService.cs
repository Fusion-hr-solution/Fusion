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
}

public sealed class OrganizationImportService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IOrganizationImportSourceInspectionService inspectionService,
    IOrganizationService organizationService) : IOrganizationImportService
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
            baseline);
    }

    private static string CreateFingerprint(InspectedOrganizationSource source)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{source.Sha256}\n{source.SelectedSheetName}\n{source.SelectedRange}")));

    private static bool IsCreationTokenConflict(DbUpdateException exception)
        => exception.InnerException is PostgresException postgres
            && postgres.SqlState == PostgresErrorCodes.UniqueViolation
            && postgres.ConstraintName == "UX_OrganizationImportSessions_Tenant_CreationToken";
}
