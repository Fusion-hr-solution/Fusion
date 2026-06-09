using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>AC#2 — a single employee's in-person attendance history, optionally date-filtered.</summary>
public record GetEmployeeAttendanceHistoryQuery(
    Guid EmployeeId,
    DateTime? From = null,
    DateTime? To = null) : IQuery<Result<EmployeeAttendanceHistoryDto>>;
