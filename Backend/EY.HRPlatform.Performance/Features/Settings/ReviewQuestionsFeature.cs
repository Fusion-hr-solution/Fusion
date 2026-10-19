using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Settings;

public sealed record ListReviewQuestionsQuery : IQuery<Result<IReadOnlyList<ReviewQuestionDto>>>;
public sealed record CreateReviewQuestionCommand(CreateReviewQuestionRequest Request) : ICommand<Result<ReviewQuestionDto>>;
public sealed record UpdateReviewQuestionCommand(Guid Id, UpdateReviewQuestionRequest Request) : ICommand<Result<ReviewQuestionDto>>;
public sealed record ArchiveReviewQuestionCommand(Guid Id, ReviewQuestionVersionRequest Request) : ICommand<Result<ReviewQuestionDto>>;
public sealed record DeleteReviewQuestionCommand(Guid Id, ReviewQuestionVersionRequest Request) : ICommand<Result<bool>>;
public sealed record ReorderReviewQuestionsCommand(ReorderReviewQuestionsRequest Request) : ICommand<Result<IReadOnlyList<ReviewQuestionDto>>>;

internal static class ReviewQuestionLibrary
{
    public const string Invalid = "ReviewQuestion.Invalid";
    public const string InUse = "ReviewQuestion.InUse";
    public const string Archived = "ReviewQuestion.Archived";

    /// <summary>The library, seeded with the nine defaults the first time a tenant reads it (like the default rating scale).</summary>
    public static async Task<List<ReviewQuestion>> LoadAsync(PerformanceDbContext db, Guid tenantId, CancellationToken token)
    {
        var questions = await db.ReviewQuestions.ToListAsync(token);
        if (questions.Count > 0) return questions;
        questions = ReviewQuestionDefaults.Create(tenantId).ToList();
        db.ReviewQuestions.AddRange(questions);
        await db.SaveChangesAsync(token);
        return questions;
    }

    public static IReadOnlyList<ReviewQuestionDto> Project(IEnumerable<ReviewQuestion> questions)
        => questions.OrderBy(item => item.Audience).ThenBy(item => item.State).ThenBy(item => item.SortOrder).ThenBy(item => item.CreatedAt)
            .Select(ToDto).ToArray();

    public static ReviewQuestionDto ToDto(ReviewQuestion item)
        => new(item.Id, item.Text, item.Audience, item.SortOrder, item.State, item.FirstUsedAt, item.Version);
}

public sealed class ListReviewQuestionsHandler(PerformanceDbContext db, ITenantContext tenant)
    : IQueryHandler<ListReviewQuestionsQuery, Result<IReadOnlyList<ReviewQuestionDto>>>
{
    public async Task<Result<IReadOnlyList<ReviewQuestionDto>>> Handle(ListReviewQuestionsQuery request, CancellationToken token)
        => Result.Success(ReviewQuestionLibrary.Project(await ReviewQuestionLibrary.LoadAsync(db, tenant.TenantId, token)));
}

public sealed class CreateReviewQuestionHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<CreateReviewQuestionCommand, Result<ReviewQuestionDto>>
{
    public async Task<Result<ReviewQuestionDto>> Handle(CreateReviewQuestionCommand command, CancellationToken token)
    {
        var library = await ReviewQuestionLibrary.LoadAsync(db, tenant.TenantId, token);
        var order = library.Where(item => item.Audience == command.Request.Audience).Select(item => item.SortOrder + 1).DefaultIfEmpty(0).Max();
        ReviewQuestion question;
        try { question = ReviewQuestion.Create(tenant.TenantId, command.Request.Text, command.Request.Audience, order); }
        catch (ArgumentException ex) { return Result.Failure<ReviewQuestionDto>(PerformanceErrors.Validation(ReviewQuestionLibrary.Invalid, ex.Message)); }
        db.ReviewQuestions.Add(question);
        audit.Record(tenant.TenantId, "ReviewQuestion", question.Id, null, PerformanceAuditActions.ReviewQuestionCreated,
            new { after = new { question.Text, audience = question.Audience.ToString() } });
        await db.SaveChangesAsync(token);
        return Result.Success(ReviewQuestionLibrary.ToDto(question));
    }
}

public sealed class UpdateReviewQuestionHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<UpdateReviewQuestionCommand, Result<ReviewQuestionDto>>
{
    public async Task<Result<ReviewQuestionDto>> Handle(UpdateReviewQuestionCommand command, CancellationToken token)
    {
        var question = await db.ReviewQuestions.FirstOrDefaultAsync(item => item.Id == command.Id, token);
        if (question is null) return Result.Failure<ReviewQuestionDto>(PerformanceErrors.NotFound("ReviewQuestion", command.Id));
        if (VersionGuard.Check(question, command.Request.ExpectedVersion) is { } stale) return Result.Failure<ReviewQuestionDto>(stale);
        var before = question.Text;
        try { question.Update(command.Request.Text); }
        catch (ArgumentException ex) { return Result.Failure<ReviewQuestionDto>(PerformanceErrors.Validation(ReviewQuestionLibrary.Invalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewQuestionDto>(PerformanceErrors.InvalidState(ReviewQuestionLibrary.Archived, ex.Message)); }
        if (before != question.Text)
        {
            audit.Record(question.TenantId, "ReviewQuestion", question.Id, null, PerformanceAuditActions.ReviewQuestionChanged,
                new { before = new { text = before }, after = new { text = question.Text } });
            await db.SaveChangesAsync(token);
        }
        return Result.Success(ReviewQuestionLibrary.ToDto(question));
    }
}

public sealed class ArchiveReviewQuestionHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<ArchiveReviewQuestionCommand, Result<ReviewQuestionDto>>
{
    public async Task<Result<ReviewQuestionDto>> Handle(ArchiveReviewQuestionCommand command, CancellationToken token)
    {
        var question = await db.ReviewQuestions.FirstOrDefaultAsync(item => item.Id == command.Id, token);
        if (question is null) return Result.Failure<ReviewQuestionDto>(PerformanceErrors.NotFound("ReviewQuestion", command.Id));
        if (question.State == ReviewQuestionState.Archived) return Result.Success(ReviewQuestionLibrary.ToDto(question));
        if (VersionGuard.Check(question, command.Request.ExpectedVersion) is { } stale) return Result.Failure<ReviewQuestionDto>(stale);
        question.Archive();
        audit.Record(question.TenantId, "ReviewQuestion", question.Id, null, PerformanceAuditActions.ReviewQuestionArchived,
            new { question.Text, audience = question.Audience.ToString(), question.FirstUsedAt });
        await db.SaveChangesAsync(token);
        return Result.Success(ReviewQuestionLibrary.ToDto(question));
    }
}

public sealed class DeleteReviewQuestionHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<DeleteReviewQuestionCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteReviewQuestionCommand command, CancellationToken token)
    {
        var question = await db.ReviewQuestions.FirstOrDefaultAsync(item => item.Id == command.Id, token);
        if (question is null) return Result.Failure<bool>(PerformanceErrors.NotFound("ReviewQuestion", command.Id));
        if (VersionGuard.Check(question, command.Request.ExpectedVersion) is { } stale) return Result.Failure<bool>(stale);
        // A Draft round's pick also counts: deleting would silently drop it from that round.
        if (question.FirstUsedAt is not null || await db.ReviewRoundQuestions.AnyAsync(item => item.QuestionId == question.Id, token))
            return Result.Failure<bool>(PerformanceErrors.InvalidState(ReviewQuestionLibrary.InUse,
                "A review round uses this question. Archive it instead."));
        audit.Record(question.TenantId, "ReviewQuestion", question.Id, null, PerformanceAuditActions.ReviewQuestionDeleted,
            new { question.Text, audience = question.Audience.ToString() });
        db.ReviewQuestions.Remove(question);
        await db.SaveChangesAsync(token);
        return Result.Success(true);
    }
}

public sealed class ReorderReviewQuestionsHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<ReorderReviewQuestionsCommand, Result<IReadOnlyList<ReviewQuestionDto>>>
{
    public async Task<Result<IReadOnlyList<ReviewQuestionDto>>> Handle(ReorderReviewQuestionsCommand command, CancellationToken token)
    {
        var library = await ReviewQuestionLibrary.LoadAsync(db, tenant.TenantId, token);
        var active = library.Where(item => item.Audience == command.Request.Audience && item.State == ReviewQuestionState.Active).ToList();
        var ids = command.Request.QuestionIds;
        if (ids.Distinct().Count() != ids.Count || ids.Count != active.Count || active.Any(item => !ids.Contains(item.Id)))
            return Result.Failure<IReadOnlyList<ReviewQuestionDto>>(PerformanceErrors.Validation(ReviewQuestionLibrary.Invalid,
                "List every active question of this audience once."));
        var before = active.OrderBy(item => item.SortOrder).Select(item => item.Id).ToArray();
        for (var index = 0; index < ids.Count; index++) active.Single(item => item.Id == ids[index]).MoveTo(index);
        if (!before.SequenceEqual(ids))
        {
            audit.Record(tenant.TenantId, "ReviewQuestion", ids[0], null, PerformanceAuditActions.ReviewQuestionsReordered,
                new { audience = command.Request.Audience.ToString(), before, after = ids });
            await db.SaveChangesAsync(token);
        }
        return Result.Success(ReviewQuestionLibrary.Project(library));
    }
}
