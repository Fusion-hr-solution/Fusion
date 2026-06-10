using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Commands;

/// <summary>
/// Employee scans a session QR code to mark their own attendance. Validates the rotating
/// HMAC payload against the stored secret, ensures the employee is enrolled and not already
/// marked, then flips the enrollment to <c>Attended</c>.
/// </summary>
public record ScanQrAttendanceCommand(Guid EmployeeId, string QrPayload)
    : ICommand<Result<ScanQrResultDto>>;

public class ScanQrAttendanceCommandHandler
    : ICommandHandler<ScanQrAttendanceCommand, Result<ScanQrResultDto>>
{
    private readonly TrainingDbContext _db;
    private readonly IQrTokenService _qr;

    public ScanQrAttendanceCommandHandler(TrainingDbContext db, IQrTokenService qr)
    {
        _db = db;
        _qr = qr;
    }

    public async Task<Result<ScanQrResultDto>> Handle(ScanQrAttendanceCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.QrPayload))
            return Result.Failure<ScanQrResultDto>(Error.Validation(
                "Qr.PayloadRequired", "QR payload is required."));

        if (!_qr.TryParseSessionId(request.QrPayload, out var sessionId))
            return Result.Failure<ScanQrResultDto>(Error.Validation(
                "Qr.Malformed", "Invalid QR code."));

        var token = await _db.SessionAttendanceTokens
            .FirstOrDefaultAsync(t => t.SessionId == sessionId, cancellationToken);

        if (token is null)
            return Result.Failure<ScanQrResultDto>(Error.Validation(
                "Qr.NotFound", "No QR code has been generated for this session."));

        var validation = _qr.Validate(request.QrPayload, token, DateTime.UtcNow);
        switch (validation.Outcome)
        {
            case QrValidationOutcome.Malformed:
            case QrValidationOutcome.SessionMismatch:
                return Result.Failure<ScanQrResultDto>(Error.Validation(
                    "Qr.Malformed", "Invalid QR code."));
            case QrValidationOutcome.Revoked:
                return Result.Failure<ScanQrResultDto>(Error.Validation(
                    "Qr.Revoked", "This QR code has been revoked by the trainer."));
            case QrValidationOutcome.Expired:
                return Result.Failure<ScanQrResultDto>(Error.Validation(
                    "Qr.Expired", "This QR code has expired."));
            case QrValidationOutcome.WindowOutOfRange:
                return Result.Failure<ScanQrResultDto>(Error.Validation(
                    "Qr.Expired", "This QR code has expired. Please scan the latest one."));
        }

        var enrollment = await _db.SessionEnrollments
            .Include(e => e.Session).ThenInclude(s => s.Part).ThenInclude(p => p.Training)
            .FirstOrDefaultAsync(e =>
                e.SessionId == sessionId && e.EmployeeId == request.EmployeeId,
                cancellationToken);

        if (enrollment is null || enrollment.Status == EnrollmentStatus.Cancelled)
            return Result.Failure<ScanQrResultDto>(Error.Validation(
                "Enrollment.NotEnrolled", "You are not enrolled in this session."));

        if (enrollment.Status == EnrollmentStatus.Attended)
            return Result.Failure<ScanQrResultDto>(Error.Conflict(
                "Enrollment.AlreadyAttended", "Your attendance has already been recorded for this session."));

        if (enrollment.Status == EnrollmentStatus.Waitlisted)
            return Result.Failure<ScanQrResultDto>(Error.Validation(
                "Enrollment.Waitlisted", "You are on the waitlist and cannot mark attendance."));

        enrollment.MarkAttended();
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(new ScanQrResultDto
        {
            SessionId = sessionId,
            TrainingTitle = enrollment.Session.Part.Training.Title,
            PartTitle = enrollment.Session.Part.Title,
            SessionStartUtc = enrollment.Session.StartUtc,
            AttendedAt = enrollment.AttendedAt ?? DateTime.UtcNow,
        });
    }
}
