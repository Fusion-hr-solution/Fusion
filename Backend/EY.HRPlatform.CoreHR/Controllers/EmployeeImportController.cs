using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/employees/import")]
[Authorize]
public class EmployeeImportController(
    IEmployeeImportWorkflowService workflowService,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("schema")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSchemaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSchema(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var schema = await workflowService.GetSchemaAsync(cancellationToken);
        return Ok(ApiResponse<EmployeeImportSchemaDto>.Success(schema));
    }

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate(
        [FromQuery] string[]? fields,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var template = await workflowService.BuildTemplateAsync(fields, cancellationToken);
        return File(template.Content, "text/csv", template.FileName);
    }

    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        [FromForm] DateTime batchEffectiveDate,
        [FromForm] EmployeeImportMode importMode = EmployeeImportMode.BusinessChange,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var session = await workflowService.UploadAsync(file, batchEffectiveDate, importMode, cancellationToken);
        return Ok(ApiResponse<EmployeeImportSessionDto>.Success(session));
    }

    [HttpPost("{sessionId:guid}/validate")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Validate(
        Guid sessionId,
        [FromQuery] int previewPageNumber = 1,
        [FromQuery] int previewPageSize = 5,
        [FromQuery] string previewFilter = "all",
        [FromQuery] string? groupKey = null,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var session = await workflowService.ValidateAsync(
            sessionId,
            previewPageNumber,
            previewPageSize,
            previewFilter,
            groupKey,
            cancellationToken);
        return Ok(ApiResponse<EmployeeImportSessionDto>.Success(session));
    }

    [HttpPost("{sessionId:guid}/apply")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportApplyOperationDto>), StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Apply(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var result = await workflowService.ApplyAsync(
            sessionId,
            new EmployeeImportActorDto(
                User.GetUserId(),
                User.GetFullName(),
                GetActorRole()),
            cancellationToken);
        return Accepted(ApiResponse<EmployeeImportApplyOperationDto>.Success(result));
    }

    [HttpGet("{sessionId:guid}/apply")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportApplyOperationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetApplyOperation(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var result = await workflowService.GetApplyOperationAsync(sessionId, cancellationToken);
        return Ok(ApiResponse<EmployeeImportApplyOperationDto>.Success(result));
    }

    [HttpGet("history")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportHistoryPageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistory(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var history = await workflowService.GetHistoryAsync(pageNumber, pageSize, cancellationToken);
        return Ok(ApiResponse<EmployeeImportHistoryPageDto>.Success(history));
    }

    [HttpGet("history/{historyId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportHistoryDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistoryDetail(
        Guid historyId,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var history = await workflowService.GetHistoryDetailAsync(historyId, cancellationToken);
        return Ok(ApiResponse<EmployeeImportHistoryDetailDto>.Success(history));
    }

    [HttpGet("{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSession(
        Guid sessionId,
        [FromQuery] int previewPageNumber = 1,
        [FromQuery] int previewPageSize = 5,
        [FromQuery] string previewFilter = "all",
        [FromQuery] string? groupKey = null,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanImportEmployees(User))
        {
            return Forbid();
        }

        var session = await workflowService.GetSessionAsync(
            sessionId,
            previewPageNumber,
            previewPageSize,
            previewFilter,
            groupKey,
            cancellationToken);
        return Ok(ApiResponse<EmployeeImportSessionDto>.Success(session));
    }

    private static string GetActorRole()
        => PlatformRole.HRAdmin;
}
