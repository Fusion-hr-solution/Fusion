using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Certifications.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/certificates")]
[Authorize]
public class CertificatesController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<CertificatesController> _logger;

    public CertificatesController(ISender sender, ILogger<CertificatesController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Public verification — anyone with the certificate number sees a masked summary.</summary>
    [HttpGet("{number}/verify")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<CertificateVerificationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Verify(string number, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new VerifyCertificateQuery(number), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<CertificateVerificationDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify certificate {Number}", number);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while verifying the certificate."));
        }
    }

    /// <summary>The current employee's own certificates (no PDF bytes).</summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(ApiResponse<List<MyCertificateDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetMyCertificatesQuery(User.GetUserId()), cancellationToken);
            return Ok(ApiResponse<List<MyCertificateDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve certificates for the current user");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving your certificates."));
        }
    }

    /// <summary>Download a certificate PDF. Owner or admin only.</summary>
    [HttpGet("{number}/download")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(string number, CancellationToken cancellationToken)
    {
        try
        {
            var isAdmin = User.IsInRole(PlatformRole.PlatformAdmin) || User.IsInRole(PlatformRole.HRAdmin);
            var result = await _sender.Send(
                new GetCertificatePdfQuery(number, User.GetUserId(), isAdmin), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code == "Certificate.Forbidden")
                    return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(result.Error.Message));
                return NotFound(ApiResponse.Failure(result.Error.Message));
            }

            var pdf = result.Value!;
            return File(pdf.Content, pdf.ContentType, pdf.FileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to download certificate {Number}", number);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while downloading the certificate."));
        }
    }
}
