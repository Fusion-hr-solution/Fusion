using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>AC#3 — attendance rate per grade (bar chart). "Unassigned" bucket for profile-less employees.</summary>
public record GetAttendanceByGradeQuery(AttendanceFilter Filter)
    : IQuery<Result<List<AttendanceByGradeDto>>>;
