using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Assessments;

/// <summary>Material-difference threshold: |self − manager| ≥ 2 on a shared item (product-fixed).</summary>
internal static class EvaluationAssessmentRules
{
    public const int MaterialDifferenceThreshold = 2;

    public static bool IsMaterialDifference(int? self, int? manager) =>
        self is int s && manager is int m && Math.Abs(s - m) >= MaterialDifferenceThreshold;

    public static string? GapState(int expected, int? assessed) => assessed switch
    {
        null => null,
        int a when a > expected => "Exceeds",
        int a when a < expected => "Below",
        _ => "Meets"
    };
}

internal static class EvaluationAssessmentErrors
{
    public static bool IsCorrectable(Exception ex) =>
        ex is DomainRuleViolationException or ArgumentException or InvalidOperationException;

    public static Result<T> Forbidden<T>() => Result.Failure<T>(Error.Forbidden(
        "Evaluations.Forbidden", "You do not have access to this evaluation assignment."));

    public static Result<T> NotFound<T>(Guid id) => Result.Failure<T>(Error.NotFound("EvaluationAssignment", id));

    public static Result<T> Invalid<T>(Exception ex) => ex is EvaluationAssessmentIncompleteException incomplete
        ? Result.Failure<T>(Error.Validation("Evaluations.IncompleteSubmission",
            $"The assessment is incomplete: {incomplete.IncompleteItems.Count} item(s) still need a response."))
        : Result.Failure<T>(Error.Validation("Evaluations.InvalidAssessment", ex.Message));
}

/// <summary>
/// Builds the frozen <see cref="EvaluationAssessmentSnapshot"/> the aggregate validates against,
/// from the round's immutable launch snapshots and the assignment's own objective plan snapshot.
/// Never resolves live configuration.
/// </summary>
internal static class EvaluationAssessmentSnapshotBuilder
{
    public static EvaluationAssessmentSnapshot Build(EvaluationRound round, EvaluationAssignment assignment)
    {
        var objectiveIds = assignment.ObjectivePlanSnapshotId is { } planId
            ? round.ObjectivePlanSnapshots
                .SingleOrDefault(plan => plan.Id == planId)?.Objectives.Select(obj => obj.Id).ToArray()
                ?? Array.Empty<Guid>()
            : Array.Empty<Guid>();
        var skillItemIds = round.SkillSnapshot?.Items.Select(item => item.Id).ToArray() ?? Array.Empty<Guid>();
        var questions = round.TemplateSnapshot!.Questions
            .Select(q => new EvaluationAssessmentQuestion(q.Id, q.Type, q.IsRequired, q.TargetRater, q.AllowNotApplicable))
            .ToArray();
        var performanceOrdinals = round.ScaleSnapshot!.Levels.Select(level => level.Ordinal).ToArray();
        var proficiencyOrdinals = round.SkillSnapshot?.Levels.Select(level => level.Ordinal).ToArray()
            ?? Array.Empty<int>();

        return new EvaluationAssessmentSnapshot(
            assignment.ObjectivePlanSnapshotId.HasValue,
            assignment.SkillSnapshotId.HasValue,
            objectiveIds,
            skillItemIds,
            questions,
            performanceOrdinals,
            proficiencyOrdinals);
    }
}

/// <summary>Loads an assignment with its responses, tenant-scoped by the ambient query filter.</summary>
internal static class EvaluationAssignmentLoader
{
    public static IQueryable<EvaluationAssignment> WithResponses(PerformanceDbContext db) =>
        db.EvaluationAssignments
            .Include(a => a.ObjectiveRatings)
            .Include(a => a.SkillRatings)
            .Include(a => a.QuestionAnswers);

    public static Task<EvaluationAssignment?> LoadAsync(PerformanceDbContext db, Guid id, CancellationToken ct) =>
        WithResponses(db).SingleOrDefaultAsync(a => a.Id == id, ct);

    public static Task<EvaluationRound?> LoadRoundAsync(PerformanceDbContext db, Guid roundId, CancellationToken ct) =>
        EvaluationRoundLoader.Query(db).AsNoTracking().SingleOrDefaultAsync(r => r.Id == roundId, ct);
}
