using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/[controller]")]
[Authorize]
public class CoursesController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll()
    {
        var courses = new[]
        {
            new { Id = 1, Title = "C# Fundamentals", Duration = "40 hours", Level = "Beginner" },
            new { Id = 2, Title = "ASP.NET Core Microservices", Duration = "60 hours", Level = "Advanced" },
            new { Id = 3, Title = "React for .NET Developers", Duration = "30 hours", Level = "Intermediate" },
            new { Id = 4, Title = "Docker & Kubernetes", Duration = "20 hours", Level = "Intermediate" }
        };

        return Ok(new { data = courses, errors = Array.Empty<string>(), isSuccess = true });
    }

    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        var course = new { Id = id, Title = "C# Fundamentals", Duration = "40 hours", Level = "Beginner" };
        return Ok(new { data = course, errors = Array.Empty<string>(), isSuccess = true });
    }

    [HttpGet("me")]
    public IActionResult GetMyEnrollments()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var fullName = User.FindFirst("full_name")?.Value;

        return Ok(new
        {
            data = new
            {
                userId,
                email,
                fullName,
                message = "JWT works through the Gateway to Training Module!",
                enrollments = new[]
                {
                    new { Course = "C# Fundamentals", Status = "Completed", Progress = 100 },
                    new { Course = "Docker & Kubernetes", Status = "In Progress", Progress = 45 }
                }
            },
            errors = Array.Empty<string>(),
            isSuccess = true
        });
    }
}