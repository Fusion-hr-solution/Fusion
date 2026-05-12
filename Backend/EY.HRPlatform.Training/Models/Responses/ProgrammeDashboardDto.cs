namespace EY.HRPlatform.Training.Models.Responses;

public class ProgrammeMatrixDto
{
    public List<GradeDto> Grades { get; set; } = [];
    public List<ServiceLineDto> ServiceLines { get; set; } = [];
    public List<ProgrammeMatrixCellDto> Cells { get; set; } = [];
}

public class ProgrammeMatrixCellDto
{
    public Guid GradeId { get; set; }
    public Guid ServiceLineId { get; set; }
    public int EmployeeCount { get; set; }
    public double AvgCompletionRate { get; set; }
    public int TotalFormations { get; set; }
    public int CompletedFormations { get; set; }
}

public class CompletionByGradeDto
{
    public Guid GradeId { get; set; }
    public string GradeName { get; set; } = string.Empty;
    public int Level { get; set; }
    public int EmployeeCount { get; set; }
    public double AvgCompletionRate { get; set; }
}

public class CompletionByServiceLineDto
{
    public Guid ServiceLineId { get; set; }
    public string ServiceLineName { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
    public double AvgCompletionRate { get; set; }
}

public class CompletionTrendDto
{
    public List<CompletionTrendPointDto> Points { get; set; } = [];
}

public class CompletionTrendPointDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Label { get; set; } = string.Empty;
    public double CompletionRate { get; set; }
    public int CompletedCount { get; set; }
    public int TotalCount { get; set; }
}

public class CellEmployeeDto
{
    public Guid EmployeeId { get; set; }
    public string GradeName { get; set; } = string.Empty;
    public string ServiceLineName { get; set; } = string.Empty;
    public int CompletedFormations { get; set; }
    public int TotalFormations { get; set; }
    public double CompletionPercentage { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public List<CellEmployeeTrainingProgressDto> TrainingBreakdown { get; set; } = [];
}

public class CellEmployeeTrainingProgressDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string TrainingType { get; set; } = string.Empty;
    public int Credits { get; set; }
    public bool IsRequired { get; set; }
    public int OrderIndex { get; set; }
    /// <summary>"not-started" | "in-progress" | "completed" | "failed"</summary>
    public string Status { get; set; } = "not-started";
    public int ProgressPercentage { get; set; }
    public DateTime? LastActivityAt { get; set; }
}
