using EY.HRPlatform.Interview.Models;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Route("api/interview/[controller]")]
public sealed class InterviewsController : ControllerBase
{
    private static readonly IReadOnlyList<InterviewDto> Interviews = new List<InterviewDto>
    {
        new()
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            CandidateName = "Alice Johnson",
            Role = "Senior Frontend Engineer",
            Status = "scheduled",
            ScheduledAt = "2026-02-20"
        },
        new()
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            CandidateName = "Bob Smith",
            Role = "Full Stack Developer",
            Status = "in-progress",
            ScheduledAt = "2026-02-18"
        },
        new()
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
            CandidateName = "Carol Williams",
            Role = "UX Designer",
            Status = "completed",
            ScheduledAt = "2026-02-15"
        }
    };

    [HttpGet]
    public ActionResult<ApiResponse<IReadOnlyList<InterviewDto>>> GetAll()
    {
        return Ok(ApiResponse<IReadOnlyList<InterviewDto>>.Success(Interviews));
    }

    [HttpGet("{id:guid}")]
    public ActionResult<ApiResponse<InterviewDto>> GetById(Guid id)
    {
        var interview = Interviews.FirstOrDefault(i => i.Id == id);
        if (interview is null)
        {
            return NotFound(ApiResponse<InterviewDto>.Failure("Interview not found."));
        }

        return Ok(ApiResponse<InterviewDto>.Success(interview));
    }
}