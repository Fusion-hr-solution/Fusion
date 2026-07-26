using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Dtos;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;

public sealed record CreateEvaluationRoundCommand(
    ClaimsPrincipal Actor, Guid CampaignId, string Name, string? Purpose,
    EvaluationRoundType Type, EvaluationAssessmentModel AssessmentModel)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record UpdateEvaluationRoundCommand(
    ClaimsPrincipal Actor, Guid RoundId, string Name, string? Purpose,
    EvaluationRoundType Type, EvaluationAssessmentModel AssessmentModel, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record SelectEvaluationRoundConfigurationCommand(
    ClaimsPrincipal Actor, Guid RoundId, Guid RatingScaleId, Guid TemplateId, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record SetEvaluationRoundDeadlinesCommand(
    ClaimsPrincipal Actor, Guid RoundId, DateTime? SelfAssessmentDeadline,
    DateTime ManagerAssessmentDeadline, DateTime FinalizationDeadline, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record SetEvaluationRoundExclusionCommand(
    ClaimsPrincipal Actor, Guid RoundId, Guid ParticipantEmployeeId, bool Excluded,
    string? Reason, uint ExpectedVersion) : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record CorrectEvaluationRoundReviewerCommand(
    ClaimsPrincipal Actor, Guid RoundId, Guid ParticipantEmployeeId,
    Guid ReviewerEmployeeId, string ReviewerName, string Reason, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record SelectEvaluationRoundExpectationSetCommand(
    ClaimsPrincipal Actor, Guid RoundId, Guid ExpectationSetId, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record RemoveEvaluationRoundSkillItemCommand(
    ClaimsPrincipal Actor, Guid RoundId, Guid DraftItemId, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record UpdateEvaluationRoundSkillExpectedLevelCommand(
    ClaimsPrincipal Actor, Guid RoundId, Guid DraftItemId, int ExpectedLevelOrdinal, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record SetEvaluationRoundWeightsCommand(
    ClaimsPrincipal Actor, Guid RoundId, int ObjectivesWeightPercent, int SkillsWeightPercent, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed record LaunchEvaluationRoundCommand(ClaimsPrincipal Actor, Guid RoundId, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundLaunchDto>>;

public sealed record ExtendEvaluationRoundDeadlineCommand(
    ClaimsPrincipal Actor, Guid RoundId, EvaluationDeadlineKind DeadlineKind,
    DateTime NewDeadline, string Reason, uint ExpectedVersion)
    : ICommand<Result<EvaluationRoundDetailDto>>;

public sealed class CreateEvaluationRoundCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, ITenantContext tenant)
    : ICommandHandler<CreateEvaluationRoundCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(CreateEvaluationRoundCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var campaign = await db.PerformanceCycles.SingleOrDefaultAsync(x => x.Id == c.CampaignId, ct);
        if (campaign is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("PerformanceCycle", c.CampaignId));
        try
        {
            var round = EvaluationRound.CreateDraft(tenant.TenantId, campaign, c.Name, c.Purpose, c.Type, c.AssessmentModel);
            db.EvaluationRounds.Add(round);
            await db.SaveChangesAsync(ct);
            return EvaluationRoundMapper.ToDetail(round);
        }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class UpdateEvaluationRoundCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<UpdateEvaluationRoundCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(UpdateEvaluationRoundCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.UpdateConfiguration(c.Name, c.Purpose, c.Type, c.AssessmentModel); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class SelectEvaluationRoundConfigurationCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SelectEvaluationRoundConfigurationCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(SelectEvaluationRoundConfigurationCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        var scale = await db.EvaluationRatingScales.Include(x => x.Levels).SingleOrDefaultAsync(x => x.Id == c.RatingScaleId, ct);
        var template = await db.EvaluationTemplates.AsSplitQuery().Include(x => x.Sections).Include(x => x.Questions).SingleOrDefaultAsync(x => x.Id == c.TemplateId, ct);
        if (scale is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("EvaluationRatingScale", c.RatingScaleId));
        if (template is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("EvaluationTemplate", c.TemplateId));
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.SelectRatingScale(scale); round.SelectTemplate(template); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class SetEvaluationRoundDeadlinesCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SetEvaluationRoundDeadlinesCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(SetEvaluationRoundDeadlinesCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.SetDeadlines(c.SelfAssessmentDeadline, c.ManagerAssessmentDeadline, c.FinalizationDeadline); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class SetEvaluationRoundExclusionCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SetEvaluationRoundExclusionCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(SetEvaluationRoundExclusionCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        var participant = await db.PerformanceCycleParticipants.SingleOrDefaultAsync(x => x.CycleId == round.PerformanceCycleId && x.EmployeeId == c.ParticipantEmployeeId, ct);
        if (participant is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("PerformanceCycleParticipant", c.ParticipantEmployeeId));
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { if (c.Excluded) round.ExcludeParticipant(participant, c.Reason ?? ""); else round.IncludeParticipant(c.ParticipantEmployeeId); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class CorrectEvaluationRoundReviewerCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<CorrectEvaluationRoundReviewerCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(CorrectEvaluationRoundReviewerCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        var participant = await db.PerformanceCycleParticipants.SingleOrDefaultAsync(x => x.CycleId == round.PerformanceCycleId && x.EmployeeId == c.ParticipantEmployeeId, ct);
        if (participant is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("PerformanceCycleParticipant", c.ParticipantEmployeeId));
        var latest = await db.PerformanceCycleApproverReassignments.AsNoTracking().Where(x => x.CycleId == round.PerformanceCycleId && x.ParticipantEmployeeId == c.ParticipantEmployeeId).OrderByDescending(x => x.ReassignedAt).FirstOrDefaultAsync(ct);
        var currentReviewer = latest?.NewApproverEmployeeId ?? participant.ApproverEmployeeId;
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.CorrectReviewer(participant, currentReviewer, c.ReviewerEmployeeId, c.ReviewerName, c.Reason); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class SelectEvaluationRoundExpectationSetCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SelectEvaluationRoundExpectationSetCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(SelectEvaluationRoundExpectationSetCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        var set = await db.SkillExpectationSets.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == c.ExpectationSetId, ct);
        if (set is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("SkillExpectationSet", c.ExpectationSetId));
        var scale = await db.ProficiencyScales.Include(x => x.Levels).SingleOrDefaultAsync(x => x.Id == set.ProficiencyScaleId, ct);
        if (scale is null) return Result.Failure<EvaluationRoundDetailDto>(Error.NotFound("ProficiencyScale", set.ProficiencyScaleId));

        var skillIds = set.Items.Select(item => item.SkillId).Distinct().ToArray();
        var skillLookup = await Skills.Queries.SkillsConfigurationQuerySupport.BuildSkillLookupAsync(db, skillIds, ct);
        var sources = skillLookup
            .Select(entry => new EvaluationRoundSkillSource(entry.Key, entry.Value.Name, entry.Value.CategoryName))
            .ToArray();

        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.SelectExpectationSet(set, scale, sources); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class RemoveEvaluationRoundSkillItemCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<RemoveEvaluationRoundSkillItemCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(RemoveEvaluationRoundSkillItemCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.RemoveDraftSkillItem(c.DraftItemId); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class UpdateEvaluationRoundSkillExpectedLevelCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<UpdateEvaluationRoundSkillExpectedLevelCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(UpdateEvaluationRoundSkillExpectedLevelCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.UpdateDraftSkillExpectedLevel(c.DraftItemId, c.ExpectedLevelOrdinal); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class SetEvaluationRoundWeightsCommandHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SetEvaluationRoundWeightsCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(SetEvaluationRoundWeightsCommand c, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try { round.SetWeights(c.ObjectivesWeightPercent, c.SkillsWeightPercent); await db.SaveChangesAsync(ct); return EvaluationRoundMapper.ToDetail(round); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

public sealed class LaunchEvaluationRoundCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, IEvaluationRoundReadinessResolver readiness,
    ITenantContext tenant, IConfigurationAuditWriter audit)
    : ICommandHandler<LaunchEvaluationRoundCommand, Result<EvaluationRoundLaunchDto>>
{
    public async Task<Result<EvaluationRoundLaunchDto>> Handle(LaunchEvaluationRoundCommand c, CancellationToken ct)
    {
        if (!access.CanOperateEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundLaunchDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundLaunchDto>(c.RoundId);
        if (round.Status != EvaluationRoundStatus.Draft)
            return Result.Failure<EvaluationRoundLaunchDto>(Error.Conflict("EvaluationRound.AlreadyLaunched", "The round has already been launched."));
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        var resolved = await readiness.ResolveAsync(round, ct);
        if (!resolved.Dto.CanLaunch)
            return Result.Failure<EvaluationRoundLaunchDto>(Error.Conflict("EvaluationRound.NotReady", string.Join(" ", resolved.Dto.Blockers.Select(x => x.Message))));

        SkillExpectationSet? expectationSet = null;
        ProficiencyScale? proficiencyScale = null;
        IReadOnlyCollection<Skill> referencedSkills = Array.Empty<Skill>();
        if (round.IncludesSkills && round.SourceExpectationSetId is { } setId)
        {
            expectationSet = await db.SkillExpectationSets.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == setId, ct);
            if (expectationSet is not null)
            {
                proficiencyScale = await db.ProficiencyScales.Include(x => x.Levels)
                    .SingleOrDefaultAsync(x => x.Id == expectationSet.ProficiencyScaleId, ct);
                var skillIds = round.DraftSkillItems.Select(item => item.SkillId).Distinct().ToArray();
                referencedSkills = await db.Skills.Where(skill => skillIds.Contains(skill.Id)).ToListAsync(ct);
            }
        }

        try
        {
            var result = round.Launch(
                resolved.Campaign,
                resolved.Scale!,
                resolved.Template!,
                expectationSet,
                proficiencyScale,
                referencedSkills,
                resolved.Candidates,
                DateTime.UtcNow);
            db.EvaluationAssignments.AddRange(result.Assignments);
            await audit.AppendTenantAsync(tenant.TenantId, c.Actor.GetUserId(), c.Actor.GetFullName(),
                "EvaluationRoundLaunched", nameof(EvaluationRound), round.Id,
                newValue: $"{result.Assignments.Count} assignments", cancellationToken: ct);
            await db.SaveChangesAsync(ct);
            return new EvaluationRoundLaunchDto(round.Id, round.Status.ToString(), round.LaunchedAt,
                round.Participants.Count, result.Assignments.Count, result.OmittedParticipants.Count, round.Version);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationRound), round.Id); }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundLaunchDto>(ex); }
    }
}

public sealed class ExtendEvaluationRoundDeadlineCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, ITenantContext tenant,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ExtendEvaluationRoundDeadlineCommand, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(ExtendEvaluationRoundDeadlineCommand c, CancellationToken ct)
    {
        if (!access.CanOperateEvaluations(c.Actor)) return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, c.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(c.RoundId);
        ConcurrencyGuard.Ensure(round.Version, c.ExpectedVersion, nameof(EvaluationRound), round.Id);
        try
        {
            round.ExtendDeadline(c.DeadlineKind, c.NewDeadline, c.Reason, c.Actor.GetUserId(), c.Actor.GetFullName(), DateTime.UtcNow);
            await audit.AppendTenantAsync(tenant.TenantId, c.Actor.GetUserId(), c.Actor.GetFullName(),
                "EvaluationRoundDeadlineExtended", nameof(EvaluationRound), round.Id,
                newValue: $"{c.DeadlineKind}: {c.NewDeadline:O}; {c.Reason}", cancellationToken: ct);
            await db.SaveChangesAsync(ct);
            var assignments = await db.EvaluationAssignments.AsNoTracking().Where(x => x.RoundId == round.Id).ToListAsync(ct);
            return EvaluationRoundMapper.ToDetail(round, assignments);
        }
        catch (Exception ex) when (EvaluationRoundErrors.IsCorrectable(ex)) { return EvaluationRoundErrors.Invalid<EvaluationRoundDetailDto>(ex); }
    }
}

internal static class EvaluationRoundLoader
{
    public static IQueryable<EvaluationRound> Query(PerformanceDbContext db) =>
        db.EvaluationRounds.AsSplitQuery()
            .Include(x => x.DraftScaleLevels).Include(x => x.DraftTemplateSections).Include(x => x.DraftTemplateQuestions)
            .Include(x => x.Exclusions).Include(x => x.ReviewerCorrections).Include(x => x.Participants)
            .Include(x => x.ObjectivePlanSnapshots).ThenInclude(x => x.Objectives).Include(x => x.DeadlineExtensions)
            .Include(x => x.ScaleSnapshot).ThenInclude(x => x!.Levels)
            .Include(x => x.TemplateSnapshot).ThenInclude(x => x!.Sections)
            .Include(x => x.TemplateSnapshot).ThenInclude(x => x!.Questions)
            .Include(x => x.PolicySnapshot)
            .Include(x => x.DraftSkillItems).Include(x => x.DraftProficiencyLevels)
            .Include(x => x.SkillSnapshot).ThenInclude(x => x!.Levels)
            .Include(x => x.SkillSnapshot).ThenInclude(x => x!.Items);

    public static Task<EvaluationRound?> LoadAsync(PerformanceDbContext db, Guid id, CancellationToken ct) =>
        Query(db).SingleOrDefaultAsync(x => x.Id == id, ct);
}

internal static class EvaluationRoundErrors
{
    public static bool IsCorrectable(Exception ex) => ex is DomainRuleViolationException or ArgumentException or InvalidOperationException;
    public static Result<T> Forbidden<T>() => Result.Failure<T>(Error.Forbidden("Evaluations.Forbidden", "You do not have permission to perform this evaluation action."));
    public static Result<T> Invalid<T>(Exception ex) => Result.Failure<T>(Error.Validation("EvaluationRound.Invalid", ex.Message));
    public static Result<T> NotFound<T>(Guid id) => Result.Failure<T>(Error.NotFound("EvaluationRound", id));
}
