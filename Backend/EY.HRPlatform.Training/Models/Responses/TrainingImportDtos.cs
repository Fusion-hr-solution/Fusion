namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>A validation issue on an import row (US-8.2.3).</summary>
public class TrainingImportIssueDto
{
    public string? Field { get; set; }
    public string Message { get; set; } = string.Empty;
    /// <summary>"error" | "warning".</summary>
    public string Severity { get; set; } = "error";
}

/// <summary>One training in the import preview (children roll up into counts + aggregated issues).</summary>
public class TrainingImportRowDto
{
    public string Ref { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Category { get; set; }
    public string? Format { get; set; }
    public int SessionCount { get; set; }
    public int ChapterCount { get; set; }
    public int ContentCount { get; set; }
    /// <summary>"ready" | "duplicate" | "error".</summary>
    public string Status { get; set; } = "ready";
    public List<TrainingImportIssueDto> Issues { get; set; } = [];
}

public class TrainingImportSummaryDto
{
    public int Total { get; set; }
    public int Ready { get; set; }
    public int Duplicate { get; set; }
    public int Error { get; set; }
}

public class TrainingImportPreviewDto
{
    public Guid? SessionId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public List<TrainingImportRowDto> Rows { get; set; } = [];
    /// <summary>Workbook-level issues (missing sheet, orphan child rows referencing unknown training Refs).</summary>
    public List<TrainingImportIssueDto> GlobalIssues { get; set; } = [];
    public TrainingImportSummaryDto Summary { get; set; } = new();
}

// ── Apply (US-8.2.3 step 4) ──────────────────────────────────────────────────

public class TrainingImportErrorDto
{
    public string Ref { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class TrainingImportResultDto
{
    public int Imported { get; set; }
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public int Failed { get; set; }
    public List<TrainingImportErrorDto> Errors { get; set; } = [];
}
