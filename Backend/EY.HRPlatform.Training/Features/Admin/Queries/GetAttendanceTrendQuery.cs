using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>AC#3 — monthly attendance-rate trend (line chart). Defaults to the last 12 months.</summary>
public record GetAttendanceTrendQuery(AttendanceFilter Filter)
    : IQuery<Result<AttendanceTrendDto>>;
