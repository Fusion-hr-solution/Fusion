using EY.HRPlatform.CoreHR.Features.Employees.Import;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportEntityTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly WorkforceImportActor Actor = new(Guid.NewGuid(), "Amina");
    private static readonly DateTime Now = new(2026, 8, 17, 0, 0, 0, DateTimeKind.Utc);

    private static WorkforceImportSession NewSession(DateOnly? baseline = null, TimeSpan? retention = null)
    {
        var session = WorkforceImportSession.Create(
            Tenant, baseline ?? new DateOnly(2026, 8, 17), Guid.NewGuid(), "fingerprint", "Sheet1", Actor, Now, retention);
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

    [Fact]
    public void Create_rejects_future_baseline()
    {
        var future = DateOnly.FromDateTime(Now).AddDays(1);
        Assert.Throws<ArgumentException>(() => WorkforceImportSession.Create(
            Tenant, future, Guid.NewGuid(), "fp", "Sheet1", Actor, Now));
    }

    [Fact]
    public void New_session_starts_in_intake_and_is_active()
    {
        var session = NewSession();
        Assert.Equal(WorkforceImportStatus.Intake, session.Status);
        Assert.True(session.IsActive);
        Assert.Equal(Now.Add(WorkforceImportSession.DefaultRetention), session.ExpiresAt);
    }

    [Fact]
    public void ReplaceDecisions_increments_revision_each_time()
    {
        var session = NewSession();
        session.ReplaceDecisions("{\"dateFormat\":\"DD/MM/YYYY\"}", Actor);
        session.ReplaceDecisions("{\"dateFormat\":\"MM/DD/YYYY\"}", Actor);
        Assert.Equal(2, session.DecisionRevision);
        Assert.Contains("MM/DD/YYYY", session.DecisionsJson);
    }

    [Fact]
    public void ReplaceDecisions_rejects_non_object_json()
        => Assert.Throws<ArgumentException>(() => NewSession().ReplaceDecisions("[1,2,3]", Actor));

    [Fact]
    public void Applying_session_is_frozen_against_all_mutations()
    {
        var session = NewSession();
        session.MoveToReviewing(2, 0, 0, 0, "rev", "obs", Actor);
        session.BeginApply("rev", Actor);
        Assert.Equal(WorkforceImportStatus.Applying, session.Status);

        Assert.Throws<InvalidOperationException>(() => session.ReplaceDecisions("{}", Actor));
        Assert.Throws<InvalidOperationException>(() => session.ChangeBaselineDate(new DateOnly(2026, 8, 1), Actor, Now));
        Assert.Throws<InvalidOperationException>(() => session.Discard(Actor));
        Assert.False(session.Expire(Now.AddYears(1)));
    }

    [Fact]
    public void ReturnToReview_unfreezes_after_pre_canonical_failure()
    {
        var session = NewSession();
        session.MoveToReviewing(2, 0, 0, 0, "rev", "obs", Actor);
        session.BeginApply("rev", Actor);
        session.ReturnToReview(Actor);
        Assert.Equal(WorkforceImportStatus.Reviewing, session.Status);
        session.ReplaceDecisions("{}", Actor); // no longer frozen
    }

    [Fact]
    public void Discard_purges_source_and_row_payload()
    {
        var session = NewSession();
        Assert.True(session.Discard(Actor));
        Assert.Equal(WorkforceImportStatus.Discarded, session.Status);
        Assert.Null(session.Source.RawBytes);
        Assert.NotNull(session.Source.PayloadPurgedAt);
        Assert.All(session.Rows, row => Assert.Null(row.SourceCellsJson));
        Assert.NotNull(session.PayloadPurgedAt);
    }

    [Fact]
    public void Commit_only_from_applying_and_purges()
    {
        var session = NewSession();
        session.MoveToReviewing(2, 0, 0, 0, "rev", "obs", Actor);
        Assert.Throws<InvalidOperationException>(() => session.Commit("d", "{}", "[]", Actor));
        session.BeginApply("rev", Actor);
        session.Commit("digest", "{}", "[]", Actor);
        Assert.Equal(WorkforceImportStatus.Committed, session.Status);
        Assert.Null(session.Source.RawBytes);
        Assert.All(session.Rows, row => Assert.Null(row.SourceCellsJson));
    }

    [Fact]
    public void Expire_only_when_past_window_and_not_applying()
    {
        var session = NewSession(retention: TimeSpan.FromDays(7));
        Assert.False(session.Expire(Now)); // not yet past
        Assert.True(session.Expire(Now.AddDays(8)));
        Assert.Equal(WorkforceImportStatus.Expired, session.Status);
        Assert.Null(session.Source.RawBytes);
        Assert.All(session.Rows, row => Assert.Null(row.SourceCellsJson));
    }
}
