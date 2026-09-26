using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportPublisher
{
    Task<OrganizationImportCommitResult> PublishAsync(
        Guid attemptId,
        uint expectedVersion,
        string reviewedProposalFingerprint,
        ImportActor actor,
        CancellationToken cancellationToken);
}

/// <summary>
/// The only boundary allowed to turn an import draft into Core Organization truth. It performs no
/// semantic work, re-derives and revalidates the draft in the write transaction, and is idempotent.
/// </summary>
public sealed class OrganizationImportPublisher(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IOrganizationService organizationService,
    IOrganizationImportInterpreter interpreter) : IOrganizationImportPublisher
{
    public async Task<OrganizationImportCommitResult> PublishAsync(
        Guid attemptId,
        uint expectedVersion,
        string reviewedProposalFingerprint,
        ImportActor actor,
        CancellationToken cancellationToken)
    {
        var initiallyLoaded = await LoadAsync(attemptId, cancellationToken);
        if (initiallyLoaded.Status == OrganizationImportStatus.Committed)
            return StoredResult(initiallyLoaded);
        if (initiallyLoaded.Status != OrganizationImportStatus.Active)
            throw new OrganizationImportReviewException("ImportTerminal", "A discarded import cannot be completed.", StatusCodes.Status409Conflict);
        dbContext.ChangeTracker.Clear();

        await using var transaction = await OrganizationWriteTransaction.BeginAsync(dbContext, tenantContext.TenantId, cancellationToken);
        var session = await LoadAsync(attemptId, cancellationToken);
        if (session.Status == OrganizationImportStatus.Committed) return StoredResult(session);
        if (session.Status != OrganizationImportStatus.Active)
            throw new OrganizationImportReviewException("ImportTerminal", "A discarded import cannot be completed.", StatusCodes.Status409Conflict);

        dbContext.Entry(session).Property(item => item.Version).OriginalValue = expectedVersion;
        // Re-derive and re-validate the exact proposal inside the write transaction; the client's
        // view of readiness is never trusted.
        var interpretation = await interpreter.InterpretAsync(session, cancellationToken);
        if (!interpretation.MatchReadiness.CanContinue || interpretation.CanonicalDraft is not { } draft || interpretation.Validation is not { } validation)
            throw new OrganizationImportReviewException(
                "MappingIncomplete", "Complete the source mapping before publishing the organization.", StatusCodes.Status409Conflict);
        if (!ImportFingerprint.Matches(draft.Fingerprint, reviewedProposalFingerprint))
            throw new OrganizationImportReviewException(
                "ProposalChanged", "The organization changed since you reviewed it. Review the current result before publishing.", StatusCodes.Status409Conflict);
        if (validation.HasBlockingIssues)
            throw new OrganizationImportReviewException(
                "StructuralValidationFailed", "Resolve every blocking issue before publishing.", StatusCodes.Status409Conflict);

        session.ApplyMappingPlan(interpretation.MappingPlan);

        var createNodes = draft.Nodes
            .Where(node => node.Classification == OrganizationImportNodeClassification.Create)
            .Select(node => new OrganizationBatchCreateNode(node.Id, node.BusinessCode, node.Name, node.TypeId!.Value,
                node.ParentNodeId, node.ParentExistingUnitId, node.IsRoot))
            .ToList();
        var created = await organizationService.CreateBatchInCurrentTransactionAsync(session.EffectiveDate, createNodes, cancellationToken);
        var result = new OrganizationImportCommitResult(session.Id, session.EffectiveDate,
            created.Select(node => new OrganizationImportCreatedUnit(node.ProposalNodeId, node.OrgUnitId, node.Code, node.Name)).ToList(),
            created.Count == 0);
        var createdByProposal = created.ToDictionary(node => node.ProposalNodeId, StringComparer.Ordinal);
        var provenance = draft.Nodes.Select(node => new OrganizationImportProvenance(
            node.Id,
            node.ExistingOrgUnitId ?? (createdByProposal.TryGetValue(node.Id, out var item) ? item.OrgUnitId : null),
            node.SourceReference,
            node.Classification.ToString())).ToList();
        // Audit: who, when, the attempt, effective date, result, and the reviewed-proposal fingerprint.
        session.Commit(draft.Fingerprint, result, provenance, actor.Normalize());
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException("Organization import", attemptId); }
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return result;
    }

    private async Task<OrganizationImportSession> LoadAsync(Guid attemptId, CancellationToken cancellationToken)
        => await dbContext.OrganizationImportSessions.Include(session => session.Source)
            .SingleOrDefaultAsync(session => session.Id == attemptId, cancellationToken)
           ?? throw new EntityNotFoundException("Organization import", attemptId);

    private static OrganizationImportCommitResult StoredResult(OrganizationImportSession session)
        => OrganizationImportJson.Deserialize<OrganizationImportCommitResult>(session.CommitResultJson)
           ?? throw new InvalidOperationException("The committed import result is unavailable.");

}
