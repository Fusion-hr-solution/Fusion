using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportEntityTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly ImportActor Actor = new(Guid.NewGuid(), "Amina");
    private static readonly DateTime Now = new(2026, 8, 17, 0, 0, 0, DateTimeKind.Utc);

    private static WorkforceImportSession NewSession(DateOnly? baseline = null)
    {
        var session = WorkforceImportSession.Create(
            Tenant, baseline ?? new DateOnly(2026, 8, 17), Guid.NewGuid(), "fingerprint", "Sheet1", Actor, Now);
        var source = WorkforceImportSource.Create(
            Tenant, session.Id, "people.csv", "csv", "text/csv", "abc", "Sheet1", "A1:C3", 3, 2, "[]", [1, 2, 3]);
        session.AttachSource(source);
        session.ReplaceRows(
        [
            WorkforceImportRow.Create(Tenant, session.Id, 1, "[\"a\"]"),
            WorkforceImportRow.Create(Tenant, session.Id, 2, "[\"b\"]"),
        ]);
        return session;
    }

    private static WorkforceImportSession Publishable()
    {
        var session = NewSession();
        session.RecordProposal(2, 0, 0, 0, 0, matchComplete: true, "fp");
        return session;
    }

    [Fact]
    public void Create_rejects_future_baseline()
    {
        var future = DateOnly.FromDateTime(Now).AddDays(1);
        Assert.Throws<ArgumentException>(() => WorkforceImportSession.Create(
            Tenant, future, Guid.NewGuid(), "fp", "Sheet1", Actor, Now));
    }

    [Fact]
    public void New_attempt_is_active_like_organization_import()
    {
        var session = NewSession();
        Assert.Equal(WorkforceImportStatus.Active, session.Status);
        Assert.True(session.IsActive);
        Assert.False(session.IsPublishing);
    }

    [Fact]
    public void Match_and_resolution_changes_increment_revision_separately_stored()
    {
        var session = NewSession();
        session.ReplaceMappingPlan("{\"dateFormat\":\"DayMonthYear\"}", Actor);
        session.ReplaceResolutions("{\"useBaselineForWorkDates\":true}", Actor);
        Assert.Equal(2, session.DecisionRevision);
        Assert.Contains("DayMonthYear", session.MappingPlanJson);
        Assert.Contains("useBaselineForWorkDates", session.ResolutionsJson);
    }

    [Fact]
    public void Decision_documents_must_be_objects()
        => Assert.Throws<ArgumentException>(() => NewSession().ReplaceMappingPlan("[1,2,3]", Actor));

    [Fact]
    public void Publishable_only_when_match_complete_nothing_blocked_and_someone_created()
    {
        var session = NewSession();
        session.RecordProposal(3, 1, 0, 0, 0, matchComplete: false, "fp");
        Assert.False(session.CanPublish);
        session.RecordProposal(3, 1, 1, 0, 0, matchComplete: true, "fp");
        Assert.False(session.CanPublish);
        session.RecordProposal(0, 4, 0, 2, 0, matchComplete: true, "fp");
        Assert.False(session.CanPublish);
        session.RecordProposal(3, 1, 0, 2, 1, matchComplete: true, "fp");
        Assert.True(session.CanPublish);
    }

    [Fact]
    public void Publishing_attempt_is_frozen_against_all_mutations()
    {
        var session = Publishable();
        session.BeginPublish(Actor);
        Assert.True(session.IsPublishing);

        Assert.Throws<InvalidOperationException>(() => session.ReplaceMappingPlan("{}", Actor));
        Assert.Throws<InvalidOperationException>(() => session.ReplaceResolutions("{}", Actor));
        Assert.Throws<InvalidOperationException>(() => session.ChangeBaselineDate(new DateOnly(2026, 8, 1), Actor, Now));
        Assert.Throws<InvalidOperationException>(() => session.Discard(Actor));
        Assert.Throws<InvalidOperationException>(() => session.BeginPublish(Actor));
    }

    [Fact]
    public void EndPublish_returns_the_attempt_to_review_unchanged()
    {
        var session = Publishable();
        session.BeginPublish(Actor);
        session.EndPublish(Actor);
        Assert.Equal(WorkforceImportStatus.Active, session.Status);
        Assert.False(session.IsPublishing);
        session.ReplaceResolutions("{}", Actor); // no longer frozen
    }

    [Fact]
    public void Discard_is_explicit_and_purges_source_and_row_payload()
    {
        var session = NewSession();
        Assert.True(session.Discard(Actor));
        Assert.Equal(WorkforceImportStatus.Discarded, session.Status);
        Assert.Null(session.Source.RawBytes);
        Assert.NotNull(session.Source.PayloadPurgedAt);
        Assert.All(session.Rows, row => Assert.Null(row.SourceCellsJson));
        Assert.NotNull(session.PayloadPurgedAt);
        Assert.False(session.Discard(Actor)); // idempotent
    }

    [Fact]
    public void Commit_only_while_publishing_keeps_result_and_purges_payload()
    {
        var session = Publishable();
        Assert.Throws<InvalidOperationException>(() => session.Commit("fp", "{}", "{}", Actor));
        session.BeginPublish(Actor);
        session.Commit("fp", "{\"addedEmployeeCount\":2}", "{}", Actor);
        Assert.Equal(WorkforceImportStatus.Committed, session.Status);
        Assert.Equal("fp", session.FinalProposalFingerprint);
        Assert.Contains("addedEmployeeCount", session.CommitResultJson);
        Assert.Null(session.Source.RawBytes);
        Assert.All(session.Rows, row => Assert.Null(row.SourceCellsJson));
        Assert.Throws<InvalidOperationException>(() => session.ReplaceMappingPlan("{}", Actor));
    }
}
