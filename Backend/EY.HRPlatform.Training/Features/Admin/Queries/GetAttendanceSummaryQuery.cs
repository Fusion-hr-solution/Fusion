using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>AC#3 — KPI cards: overall rate, total sessions, total in-person hours delivered.</summary>
public record GetAttendanceSummaryQuery(AttendanceFilter Filter)
    : IQuery<Result<AttendanceSummaryDto>>;
