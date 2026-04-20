namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;

public sealed record DraftSetupIssueDto(
    string Severity,
    string Category,
    string Code,
    string Message,
    Guid? UnitId,
    string? Field);