using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Features.Calendar.Feed;
using EY.HRPlatform.Training.Features.Calendar.Ics;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Queries;

/// <summary>Build the subscribable ICS feed for whoever owns the given opaque feed token.</summary>
public record GetMyCalendarIcsQuery(string? Token) : IQuery<Result<string>>;

public class GetMyCalendarIcsQueryHandler : IQueryHandler<GetMyCalendarIcsQuery, Result<string>>
{
    // A bad/revoked/unknown token is indistinguishable from "no such feed" → surfaced as 404.
    private static readonly Error InvalidToken = Error.NotFound("CalendarFeedToken", Guid.Empty);

    // Feed window: recent history for context + two quarters ahead (CONTEXT.md).
    private static readonly TimeSpan LookBack = TimeSpan.FromDays(30);
    private static readonly TimeSpan LookAhead = TimeSpan.FromDays(180);

    private readonly TrainingDbContext _db;
    private readonly ICalendarFeedTokenService _tokens;
    private readonly ISender _sender;
    private readonly ICalendarFeedService _feed;

    public GetMyCalendarIcsQueryHandler(
        TrainingDbContext db, ICalendarFeedTokenService tokens, ISender sender, ICalendarFeedService feed)
    {
        _db = db;
        _tokens = tokens;
        _sender = sender;
        _feed = feed;
    }

    public async Task<Result<string>> Handle(GetMyCalendarIcsQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return Result.Failure<string>(InvalidToken);

        var hash = _tokens.Hash(request.Token);
        var row = await _db.CalendarFeedTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.RevokedAt == null, cancellationToken);

        if (row is null)
            return Result.Failure<string>(InvalidToken);

        var now = DateTime.UtcNow;
        var events = await _sender.Send(
            new GetMyCalendarQuery(row.EmployeeId, now - LookBack, now + LookAhead), cancellationToken);

        // The subscription feed carries only confirmed events — waitlisted are excluded until promoted.
        var feedEvents = (events.IsSuccess ? events.Value : new List<CalendarEventDto>())
            .Where(e => !e.IsWaitlisted)
            .ToList();

        return Result.Success(_feed.Build(feedEvents, "EY Academy"));
    }
}
