using EY.HRPlatform.Training.Features.Internal.Commands;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>
/// Internal service-to-service endpoints.
/// NOT routed through the public Gateway; protected by X-Service-Key shared secret.
/// </summary>
[ApiController]
[Route("api/training/internal")]
public class InternalSyncController : ControllerBase
{
    private readonly ISender _sender;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InternalSyncController> _logger;

    public InternalSyncController(
        ISender sender,
        IConfiguration configuration,
        ILogger<InternalSyncController> logger)
    {
        _sender = sender;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Creates an empty EmployeeProfile for the given employee if one does not already exist.
    /// Called by the Identity service when a user is assigned the Employee role.
    /// Idempotent: safe to call multiple times for the same employee.
    /// </summary>
    [HttpPost("employees/provision")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProvisionEmployee(
        [FromHeader(Name = "X-Service-Key")] string? serviceKey,
        [FromBody] ProvisionEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        var expectedKey = _configuration["ServiceIntegration:ApiKey"];
        if (string.IsNullOrWhiteSpace(expectedKey) || serviceKey != expectedKey)
        {
            _logger.LogWarning("Rejected internal /employees/provision call — invalid or missing X-Service-Key");
            return Unauthorized();
        }

        var result = await _sender.Send(
            new ProvisionEmployeeCommand(request.EmployeeId, request.FullName, request.Email), cancellationToken);

        if (result.IsFailure)
        {
            _logger.LogError("ProvisionEmployee failed for {EmployeeId}: {Error}",
                request.EmployeeId, result.Error.Message);
            return BadRequest(ApiResponse.Failure(result.Error.Message));
        }

        return Ok(ApiResponse.Success());
    }
}

