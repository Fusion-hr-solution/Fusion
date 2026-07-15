using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Calendar.Feed;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Training.Features.Calendar.Commands;

/// <summary>Issue or rotate the signed-in learner's calendar feed token, returning the new subscribe URL.</summary>
public record RotateCalendarFeedTokenCommand(Guid EmployeeId) : ICommand<Result<CalendarFeedSubscriptionDto>>;

public class RotateCalendarFeedTokenCommandHandler
    : ICommandHandler<RotateCalendarFeedTokenCommand, Result<CalendarFeedSubscriptionDto>>
{
    private const string DefaultBaseUrl = "https://localhost:5200";

    private readonly TrainingDbContext _db;
    private readonly ICalendarFeedTokenService _tokens;
    private readonly IConfiguration _configuration;

    public RotateCalendarFeedTokenCommandHandler(
        TrainingDbContext db, ICalendarFeedTokenService tokens, IConfiguration configuration)
    {
        _db = db;
        _tokens = tokens;
        _configuration = configuration;
    }

    public async Task<Result<CalendarFeedSubscriptionDto>> Handle(RotateCalendarFeedTokenCommand request, CancellationToken cancellationToken)
    {
        var (token, hash) = _tokens.Issue();

        // One row per employee: reuse it (rotate, which clears any prior revocation) or create it.
        // A concurrent first-time rotate can lose the insert race on the active-row unique index;
        // catch that and rotate the row the winner committed instead of bubbling a 500.
        try
        {
            var existing = await _db.CalendarFeedTokens
                .FirstOrDefaultAsync(t => t.EmployeeId == request.EmployeeId, cancellationToken);

            if (existing is null)
                _db.CalendarFeedTokens.Add(new CalendarFeedToken(request.EmployeeId, hash));
            else
                existing.Rotate(hash);

            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            var existing = await _db.CalendarFeedTokens
                .FirstOrDefaultAsync(t => t.EmployeeId == request.EmployeeId, cancellationToken);
            if (existing is null) throw;
            existing.Rotate(hash);
            await _db.SaveChangesAsync(cancellationToken);
        }

        var configured = _configuration["Calendar:FeedBaseUrl"]?.Trim();
        var baseUrl = (string.IsNullOrWhiteSpace(configured) ? DefaultBaseUrl : configured).TrimEnd('/');
        var feedUrl = $"{baseUrl}/api/training/calendar/me.ics?token={token}";
        var webcalUrl = feedUrl.Replace("https://", "webcal://").Replace("http://", "webcal://");

        return Result.Success(new CalendarFeedSubscriptionDto
        {
            Token = token,
            FeedUrl = feedUrl,
            WebcalUrl = webcalUrl
        });
    }
}
