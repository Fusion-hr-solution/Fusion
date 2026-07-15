using System.Text.Json;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Import;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>
/// US-8.2.3 / US-8.2.4 — bulk training import: template download, upload + validate + preview, and
/// apply (with a downloadable error log). Admin-only.
/// </summary>
[ApiController]
[Route("api/training/admin/imports/trainings")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminTrainingImportController : ControllerBase
{
    private const string ExcelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly ISender _sender;
    private readonly ITrainingImportTemplateGenerator _fileGenerator;

    public AdminTrainingImportController(ISender sender, ITrainingImportTemplateGenerator fileGenerator)
    {
        _sender = sender;
        _fileGenerator = fileGenerator;
    }

    /// <summary>US-8.2.4 — download the pre-formatted Excel import template.</summary>
    [HttpGet("template")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadTemplate(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GenerateTrainingImportTemplateQuery(), cancellationToken);
        return File(result.Value!, ExcelContentType, "training-import-template.xlsx");
    }

    /// <summary>US-8.2.3 — upload a workbook; returns a validated preview + a staged session id.</summary>
    [HttpPost]
    [RequestSizeLimit(10_000_000)]
    [ProducesResponseType(typeof(ApiResponse<TrainingImportPreviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upload(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse.Failure("No file was uploaded."));

        var ext = Path.GetExtension(file.FileName);
        if (!ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase)
            && !ext.Equals(".xls", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure("Please upload an .xlsx or .xls file."));

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);

        var result = await _sender.Send(
            new UploadTrainingImportCommand(ms.ToArray(), file.FileName, User.GetUserId()), cancellationToken);

        if (result.IsFailure)
            return BadRequest(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<TrainingImportPreviewDto>.Success(result.Value!));
    }

    /// <summary>US-8.2.3 — re-read a staged import preview by session id.</summary>
    [HttpGet("{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TrainingImportPreviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPreview(Guid sessionId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new GetTrainingImportPreviewQuery(sessionId, User.GetUserId()), cancellationToken);

        if (result.IsFailure)
        {
            if (result.Error.Code.EndsWith(".NotFound", StringComparison.Ordinal))
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return BadRequest(ApiResponse.Failure(result.Error.Message));
        }

        return Ok(ApiResponse<TrainingImportPreviewDto>.Success(result.Value!));
    }

    /// <summary>US-8.2.3 — apply a re-uploaded, validated workbook. `actions` maps a duplicate's Ref to skip/createNew/safeUpdate.</summary>
    [HttpPost("apply")]
    [RequestSizeLimit(10_000_000)]
    [ProducesResponseType(typeof(ApiResponse<TrainingImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Apply(
        [FromForm] IFormFile? file, [FromForm] string? actions, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse.Failure("No file was uploaded."));

        var ext = Path.GetExtension(file.FileName);
        if (!ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase)
            && !ext.Equals(".xls", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure("Please upload an .xlsx or .xls file."));

        Dictionary<string, string> actionMap;
        try
        {
            actionMap = string.IsNullOrWhiteSpace(actions)
                ? new Dictionary<string, string>()
                : JsonSerializer.Deserialize<Dictionary<string, string>>(actions) ?? new Dictionary<string, string>();
        }
        catch (JsonException)
        {
            return BadRequest(ApiResponse.Failure("Invalid duplicate-actions payload."));
        }

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);

        var result = await _sender.Send(
            new ApplyTrainingImportCommand(ms.ToArray(), file.FileName, User.GetUserId(), actionMap), cancellationToken);

        if (result.IsFailure)
            return BadRequest(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<TrainingImportResultDto>.Success(result.Value!));
    }

    /// <summary>US-8.2.3 — download an Excel error log of failed rows (the client posts the errors it received).</summary>
    [HttpPost("error-log")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult DownloadErrorLog([FromBody] List<TrainingImportErrorDto>? errors)
    {
        var bytes = _fileGenerator.GenerateErrorLog(errors ?? []);
        return File(bytes, ExcelContentType, "training-import-errors.xlsx");
    }
}
