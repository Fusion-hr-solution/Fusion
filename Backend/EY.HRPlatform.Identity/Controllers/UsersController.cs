using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/[controller]")]
[Authorize(Roles = $"{PlatformRole.Admin},{PlatformRole.HR}")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public UsersController(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAll()
    {
        var users = await _userManager.Users
            .Where(u => u.IsActive)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Email = u.Email!,
                FullName = u.FullName,
                Department = u.Department,
                JobTitle = u.JobTitle,
                HireDate = u.HireDate
            })
            .ToListAsync();

        return Ok(ApiResponse<List<UserDto>>.Success(users));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetById(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound(ApiResponse<UserDto>.Failure("User not found."));

        var roles = await _userManager.GetRolesAsync(user);

        var dto = new UserDto
        {
            Id = user.Id,
            Email = user.Email!,
            FullName = user.FullName,
            Department = user.Department,
            JobTitle = user.JobTitle,
            HireDate = user.HireDate,
            Roles = roles.ToList()
        };

        return Ok(ApiResponse<UserDto>.Success(dto));
    }

    [HttpPost("{id:guid}/roles/{role}")]
    public async Task<ActionResult<ApiResponse>> AssignRole(Guid id, string role)
    {
        // Validate role exists
        if (!PlatformRole.All.Contains(role))
            return BadRequest(ApiResponse.Failure($"Invalid role: {role}"));

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound(ApiResponse.Failure("User not found."));

        var result = await _userManager.AddToRoleAsync(user, role);
        if (!result.Succeeded)
            return BadRequest(ApiResponse.Failure(
                result.Errors.Select(e => e.Description).ToArray()));

        return Ok(ApiResponse.Success());
    }

    [HttpDelete("{id:guid}/roles/{role}")]
    public async Task<ActionResult<ApiResponse>> RemoveRole(Guid id, string role)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound(ApiResponse.Failure("User not found."));

        var result = await _userManager.RemoveFromRoleAsync(user, role);
        if (!result.Succeeded)
            return BadRequest(ApiResponse.Failure(
                result.Errors.Select(e => e.Description).ToArray()));

        return Ok(ApiResponse.Success());
    }
}