using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Queries;

/// <summary>Get the current rotating QR payload + refresh metadata for a session.</summary>
public record GetSessionQrCodeQuery(Guid SessionId) : IQuery<Result<SessionQrCodeDto>>;

public class GetSessionQrCodeQueryHandler : IQueryHandler<GetSessionQrCodeQuery, Result<SessionQrCodeDto>>
{
    private readonly TrainingDbContext _db;
    private readonly IQrTokenService _qr;

    public GetSessionQrCodeQueryHandler(TrainingDbContext db, IQrTokenService qr)
    {
        _db = db;
        _qr = qr;
    }

    public async Task<Result<SessionQrCodeDto>> Handle(GetSessionQrCodeQuery request, CancellationToken cancellationToken)
    {
        var token = await _db.SessionAttendanceTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.SessionId == request.SessionId, cancellationToken);

        if (token is null)
            return Result.Failure<SessionQrCodeDto>(Error.NotFound("SessionAttendanceToken", request.SessionId));

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
