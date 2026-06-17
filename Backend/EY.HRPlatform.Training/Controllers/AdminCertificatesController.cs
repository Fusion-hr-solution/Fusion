using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Certifications.Commands;
using EY.HRPlatform.Training.Features.Certifications.Export;
using EY.HRPlatform.Training.Features.Certifications.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/certificates")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminCertificatesController : ControllerBase
{
    private const string ExcelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly ISender _sender;
    private readonly ICertificateRegistryExporter _exporter;
    private readonly ILogger<AdminCertificatesController> _logger;

    public AdminCertificatesController(
        ISender sender, ICertificateRegistryExporter exporter, ILogger<AdminCertificatesController> logger)
    {
        _sender = sender;
        _exporter = exporter;
        _logger = logger;
    }

    /// <summary>The certificate registry — paged, filterable by formation, grade, date range, status.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<CertificateRegistryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRegistry(
        [FromQuery] Guid? trainingId,
        [FromQuery] Guid? gradeId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _sender.Send(
                new GetCertificateRegistryQuery(trainingId, gradeId, from, to, status, search, page, pageSize),
                cancellationToken);
            return Ok(ApiResponse<PagedResponse<CertificateRegistryDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve certificate registry");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the certificate registry."));
        }
    }

    /// <summary>Registry statistics: totals, by formation, by month.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(ApiResponse<CertificateStatsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCertificateStatsQuery(), cancellationToken);
            return Ok(ApiResponse<CertificateStatsDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve certificate stats");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving certificate statistics."));
        }
    }

    /// <summary>Revoke a certificate (terminal) with a required reason.</summary>
    [HttpPost("{id:guid}/revoke")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Revoke(
        Guid id,
        [FromBody] RevokeCertificateRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new RevokeCertificateCommand(id, request.Reason, User.GetEmail()), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("AlreadyRevoked")) return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to revoke certificate {CertificateId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while revoking the certificate."));
        }
    }

    /// <summary>Reinstate a mistakenly-revoked certificate (audited). Fails if a newer active one exists.</summary>
    [HttpPost("{id:guid}/reinstate")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reinstate(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new ReinstateCertificateCommand(id, User.GetEmail()), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("NotRevoked") || result.Error.Code.Contains("ActiveExists"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reinstate certificate {CertificateId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reinstating the certificate."));
        }
    }

    /// <summary>Export the (filtered) registry to Excel.</summary>
    [HttpGet("export/excel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public Task<IActionResult> ExportExcel(
        [FromQuery] Guid? trainingId, [FromQuery] Guid? gradeId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? status, [FromQuery] string? search, CancellationToken cancellationToken)
        => ExportAsync("excel", trainingId, gradeId, from, to, status, search, cancellationToken);

    /// <summary>Export the (filtered) registry to PDF.</summary>
    [HttpGet("export/pdf")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public Task<IActionResult> ExportPdf(
        [FromQuery] Guid? trainingId, [FromQuery] Guid? gradeId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? status, [FromQuery] string? search, CancellationToken cancellationToken)
        => ExportAsync("pdf", trainingId, gradeId, from, to, status, search, cancellationToken);

    private async Task<IActionResult> ExportAsync(
        string format, Guid? trainingId, Guid? gradeId, DateTime? from, DateTime? to,
        string? status, string? search, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetCertificateRegistryForExportQuery(trainingId, gradeId, from, to, status, search), cancellationToken);
            var rows = result.Value!;

            return format == "excel"
                ? File(_exporter.ToExcel(rows), ExcelContentType, "certificate-registry.xlsx")
                : File(_exporter.ToPdf(rows), "application/pdf", "certificate-registry.pdf");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export certificate registry ({Format})", format);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while exporting the certificate registry."));
        }
    }
}
