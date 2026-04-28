using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/employees/import")]
[Authorize(Roles = PlatformRole.HRAdmin)]
public class EmployeeImportController(
    IEmployeeImportWorkflowService workflowService) : ControllerBase
{
    [HttpGet("schema")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSchemaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSchema(CancellationToken cancellationToken)
    {
        var schema = await workflowService.GetSchemaAsync(cancellationToken);
        return Ok(ApiResponse<EmployeeImportSchemaDto>.Success(schema));
    }

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate(CancellationToken cancellationToken)
    {
        var template = await workflowService.BuildTemplateAsync(cancellationToken);
        return File(template.Content, "text/csv", template.FileName);
    }

    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        var session = await workflowService.UploadAsync(file, cancellationToken);
        return Ok(ApiResponse<EmployeeImportSessionDto>.Success(session));
    }

    [HttpGet("{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSession(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await workflowService.GetSessionAsync(sessionId, cancellationToken);
        return Ok(ApiResponse<EmployeeImportSessionDto>.Success(session));
    }
}