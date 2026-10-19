using EY.HRPlatform.Performance.Domain.Conversations;

namespace EY.HRPlatform.Performance.Features.Security.Policies;

/// <summary>
/// A 1:1 belongs to its two people and nobody else (D-12, D-R3): administration grants nothing here. Acting as the
/// manager side also needs the direct-reports grant, as everywhere in Performance.
/// </summary>
public static class OneOnOnePolicy
{
    public static IQueryable<OneOnOneSeries> Readable(IQueryable<OneOnOneSeries> series, Guid employeeId)
        => employeeId == Guid.Empty ? series.Where(_ => false)
            : series.Where(s => s.ManagerEmployeeId == employeeId || s.ReportEmployeeId == employeeId);

    public static bool CanRead(OneOnOneSeries series, Guid employeeId) => series.Involves(employeeId);

    /// <summary>Either person writes while the series is active; the manager side needs the direct-reports grant.</summary>
    public static bool CanWrite(OneOnOneSeries series, Guid employeeId, bool reviewsReports)
        => series.IsActive && series.Involves(employeeId) && (employeeId == series.ReportEmployeeId || reviewsReports);
}

/// <summary>Who reads feedback, for lists, counts, the summary, 1:1 suggestions and the objective record alike.</summary>
public sealed record FeedbackViewer(Guid EmployeeId, bool IsAdministrator, bool ReviewsReports, IReadOnlySet<Guid> DirectReportIds)
{
    public static FeedbackViewer For(Guid employeeId, bool isAdministrator, bool reviewsReports, IReadOnlySet<Guid>? directReportIds)
        => new(employeeId, isAdministrator, reviewsReports, reviewsReports ? directReportIds ?? new HashSet<Guid>() : new HashSet<Guid>());
}

/// <summary>
/// D-13 and D-R3. Shared feedback: the receiver, the author, the manager it was addressed to at sending, the receiver's
/// current manager and administrators. Manager-only feedback: its addressed manager and its author, never the receiver
/// and never administration. Manager rules need the direct-reports grant.
/// </summary>
public static class FeedbackPolicy
{
    public static IQueryable<Feedback> Readable(IQueryable<Feedback> feedback, FeedbackViewer viewer)
    {
        var me = viewer.EmployeeId;
        var manages = viewer.ReviewsReports && me != Guid.Empty;
        var reports = viewer.DirectReportIds.ToList();
        var admin = viewer.IsAdministrator;
        return feedback.Where(f =>
            (me != Guid.Empty && f.AuthorEmployeeId == me)
            || (me != Guid.Empty && f.Visibility == FeedbackVisibility.Shared && f.ReceiverEmployeeId == me)
            || (manages && f.AddressedManagerEmployeeId == me)
            || (manages && f.Visibility == FeedbackVisibility.Shared && reports.Contains(f.ReceiverEmployeeId))
            || (admin && f.Visibility == FeedbackVisibility.Shared));
    }

    public static bool CanRead(Feedback f, FeedbackViewer viewer)
    {
        var me = viewer.EmployeeId;
        var manages = viewer.ReviewsReports && me != Guid.Empty;
        return (me != Guid.Empty && f.AuthorEmployeeId == me)
            || (me != Guid.Empty && f.Visibility == FeedbackVisibility.Shared && f.ReceiverEmployeeId == me)
            || (manages && f.AddressedManagerEmployeeId == me)
            || (manages && f.Visibility == FeedbackVisibility.Shared && viewer.DirectReportIds.Contains(f.ReceiverEmployeeId))
            || (viewer.IsAdministrator && f.Visibility == FeedbackVisibility.Shared);
    }
}

/// <summary>
/// A feedback request's full view (every invitee and answer) is for the requester, their current manager and
/// administrators; an invitee gets only their own part, through a separate projection.
/// </summary>
public static class FeedbackRequestPolicy
{
    public static bool CanReadAll(FeedbackRequest request, FeedbackViewer viewer)
        => (viewer.EmployeeId != Guid.Empty && request.RequesterEmployeeId == viewer.EmployeeId)
            || (viewer.ReviewsReports && viewer.DirectReportIds.Contains(request.RequesterEmployeeId))
            || viewer.IsAdministrator;

    public static bool IsInvitee(FeedbackRequest request, Guid employeeId)
        => employeeId != Guid.Empty && request.Invitees.Any(i => i.EmployeeId == employeeId);
}

/// <summary>Praise is public to every Performance entrant (D-14); the author or an administrator deletes it.</summary>
public static class PraisePolicy
{
    public static IQueryable<Praise> Readable(IQueryable<Praise> praise) => praise.Where(p => p.DeletedAt == null);

    public static bool CanDelete(Praise praise, Guid employeeId, bool isAdministrator)
        => !praise.IsDeleted && (isAdministrator || (employeeId != Guid.Empty && praise.AuthorEmployeeId == employeeId));
}
