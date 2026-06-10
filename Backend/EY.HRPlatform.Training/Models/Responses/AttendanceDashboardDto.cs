namespace EY.HRPlatform.Training.Models.Responses;

// ── AC#1 Per-Session ────────────────────────────────────────────────────────

public class SessionAttendanceDto
{
    public Guid SessionId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public bool IsClosed { get; set; }
    public int PresentCount { get; set; }
    public int AbsentCount { get; set; }
    public int PendingCount { get; set; }
    /// <summary>Present + Absent (the denominator for the rate). Excludes pending.</summary>
    public int CountedTotal { get; set; }
    public double AttendanceRate { get; set; }
    public List<SessionAttendanceAttendeeDto> Attendees { get; set; } = [];
}

public class SessionAttendanceAttendeeDto
{
    public Guid EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public string? EmployeeEmail { get; set; }
    /// <summary>"present" | "absent" | "pending"</summary>
    public string Status { get; set; } = "pending";
}

// ── AC#2 Per-Employee ───────────────────────────────────────────────────────

public class EmployeeAttendanceHistoryDto
{
    public Guid EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public double OverallAttendanceRate { get; set; }
    public decimal TotalInPersonHours { get; set; }
    public int PresentCount { get; set; }
    public int AbsentCount { get; set; }
    public List<EmployeeAttendanceRecordDto> Records { get; set; } = [];
}

public class EmployeeAttendanceRecordDto
{
    public Guid SessionId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public DateTime SessionDate { get; set; }
    /// <summary>"present" | "absent" | "pending"</summary>
    public string Status { get; set; } = "pending";
    public decimal Hours { get; set; }
}

// ── AC#3 Aggregations ───────────────────────────────────────────────────────

public class AttendanceByGradeDto
{
    public Guid? GradeId { get; set; }
    public string GradeName { get; set; } = string.Empty;
    public int Level { get; set; }
    public double AttendanceRate { get; set; }
    public int PresentCount { get; set; }
    public int CountedTotal { get; set; }
}

public class AttendanceTrendDto
{
    public List<AttendanceTrendPointDto> Points { get; set; } = [];
}

public class AttendanceTrendPointDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Label { get; set; } = string.Empty;
    public double AttendanceRate { get; set; }
    public int PresentCount { get; set; }
    public int CountedTotal { get; set; }
}

public class AttendanceHeatmapDto
{
    public List<GradeDto> Grades { get; set; } = [];
    public List<AttendanceHeatmapMonthDto> Months { get; set; } = [];
    public List<AttendanceHeatmapCellDto> Cells { get; set; } = [];
}

public class AttendanceHeatmapMonthDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Label { get; set; } = string.Empty;
}

public class AttendanceHeatmapCellDto
{
    public Guid? GradeId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public double AttendanceRate { get; set; }
    public int PresentCount { get; set; }
    public int CountedTotal { get; set; }
}

public class AttendanceSummaryDto
{
    public double OverallAttendanceRate { get; set; }
    public int TotalSessions { get; set; }
    public decimal TotalHoursDelivered { get; set; }
    public int TotalPresent { get; set; }
    public int TotalAbsent { get; set; }
}
