using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>AC#3 — Grade × Month attendance-rate heatmap. Defaults to the last 12 months.</summary>
public record GetAttendanceHeatmapQuery(AttendanceFilter Filter)
    : IQuery<Result<AttendanceHeatmapDto>>;
