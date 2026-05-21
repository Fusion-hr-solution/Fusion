using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

/// <summary>
/// Generate (or rotate) the attendance QR code for a session. Returns the current
/// rotating payload + refresh metadata. The payload itself rotates every
/// <c>RotationSeconds</c> with no extra DB writes. Pass <c>Regenerate=true</c> to
/// invalidate any previously captured QR images.
/// </summary>
public record GenerateSessionQrCodeCommand(Guid SessionId, bool Regenerate)
    : ICommand<Result<SessionQrCodeDto>>;

public class GenerateSessionQrCodeCommandHandler
    : ICommandHandler<GenerateSessionQrCodeCommand, Result<SessionQrCodeDto>>
{
    /// <summary>Buffer added to session.EndUtc to compute the token's ValidUntil.</summary>
    public static readonly TimeSpan PostSessionBuffer = TimeSpan.FromMinutes(30);
    public const int DefaultRotationSeconds = 300;

    private readonly TrainingDbContext _db;
    private readonly IQrTokenService _qr;

    public GenerateSessionQrCodeCommandHandler(TrainingDbContext db, IQrTokenService qr)
    {
        _db = db;
        _qr = qr;
    }

    public async Task<Result<SessionQrCodeDto>> Handle(
        GenerateSessionQrCodeCommand request, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure<SessionQrCodeDto>(Error.NotFound("TrainingSession", request.SessionId));

        if (session.Status == SessionStatus.Cancelled)
            return Result.Failure<SessionQrCodeDto>(Error.Validation(
                "Session.Cancelled",
                "Cannot generate a QR code for a cancelled session."));

        var validUntil = session.EndUtc + PostSessionBuffer;
        if (DateTime.UtcNow > validUntil)
            return Result.Failure<SessionQrCodeDto>(Error.Validation(
                "Session.Ended",
                "Cannot generate a QR code: the session has already ended."));

        var token = await _db.SessionAttendanceTokens
            .FirstOrDefaultAsync(t => t.SessionId == request.SessionId, cancellationToken);

        if (token is null)
        {
            token = new SessionAttendanceToken(session.Id, validUntil, DefaultRotationSeconds);
            _db.SessionAttendanceTokens.Add(token);
        }
        else if (request.Regenerate)
        {
            token.RotateSecret(validUntil);
        }
        else if (token.IsRevoked)
        {
            // Re-activate revoked token: rotate to a fresh secret.
            token.RotateSecret(validUntil);
        }

        await _db.SaveChangesAsync(cancellationToken);

        var info = _qr.Build(token, DateTime.UtcNow);
        return Result.Success(new SessionQrCodeDto
        {
            SessionId = token.SessionId,
            Payload = info.Payload,
            RotationSeconds = token.RotationSeconds,
            IssuedAt = info.IssuedAt,
            RefreshAt = info.RefreshAt,
            ExpiresAt = token.ValidUntil,
            IsRevoked = token.IsRevoked,
        });
    }
}
