using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>AC#1 — attendance breakdown for a single session (present / absent / pending).</summary>
public record GetSessionAttendanceQuery(Guid SessionId) : IQuery<Result<SessionAttendanceDto>>;
