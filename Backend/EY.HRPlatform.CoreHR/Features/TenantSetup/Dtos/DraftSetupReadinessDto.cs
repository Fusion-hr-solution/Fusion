namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;

public sealed record DraftSetupReadinessDto(
    bool IsReadyForApproval,
    int TotalUnitCount,
    int RootUnitCount,
    int BlockingIssueCount,
    int WarningCount,
    List<DraftSetupIssueDto> BlockingIssues,
    List<DraftSetupIssueDto> Warnings);