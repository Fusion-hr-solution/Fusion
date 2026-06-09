using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

/// <summary>Mark a session's attendance QR code as revoked (no further scans accepted).</summary>
public record RevokeSessionQrCodeCommand(Guid SessionId) : ICommand<Result>;

public class RevokeSessionQrCodeCommandHandler : ICommandHandler<RevokeSessionQrCodeCommand, Result>
{
    private readonly TrainingDbContext _db;

    public RevokeSessionQrCodeCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(RevokeSessionQrCodeCommand request, CancellationToken cancellationToken)
    {
        var token = await _db.SessionAttendanceTokens
            .FirstOrDefaultAsync(t => t.SessionId == request.SessionId, cancellationToken);

        if (token is null)
            return Result.Failure(Error.NotFound("SessionAttendanceToken", request.SessionId));

        token.Revoke();
        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
