namespace EY.HRPlatform.Training.Models.Responses;

// ── US-8.2.1 Attendance report (per employee) ────────────────────────────────

public class AttendanceByEmployeeRowDto
{
    public Guid EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public string? Email { get; set; }
    public string GradeName { get; set; } = "Unassigned";
    public string ServiceLineName { get; set; } = "Unassigned";
    public int SessionsEnrolled { get; set; }
    public int Attended { get; set; }
    public int Missed { get; set; }
    public double AttendanceRate { get; set; }
}

// ── US-8.2.1 Training-hours report (per employee) ────────────────────────────

public class TrainingHoursRowDto
{
    public Guid EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public string GradeName { get; set; } = "Unassigned";
    public string ServiceLineName { get; set; } = "Unassigned";
    /// <summary>Estimated e-learning hours (authored content duration, with a per-training fallback).</summary>
    public double ELearningHours { get; set; }
    /// <summary>In-person hours = attended-session wall-clock.</summary>
    public double InPersonHours { get; set; }
    public double TotalHours { get; set; }
    public int TrainingsCompleted { get; set; }
}

// ── US-8.2.2 In-person vs e-learning comparison ──────────────────────────────

public class FormatMetricsDto
{
    /// <summary>"ELearning" | "OnSite".</summary>
    public string Format { get; set; } = string.Empty;
    public int TrainingCount { get; set; }
    public double HoursDelivered { get; set; }
    public int Participants { get; set; }
    public double CompletionRate { get; set; }
    /// <summary>Average overall feedback rating (null when no feedback in scope).</summary>
    public double? AvgFeedback { get; set; }
}

public class FormatComparisonDto
{
    public FormatMetricsDto ELearning { get; set; } = new() { Format = "ELearning" };
    public FormatMetricsDto OnSite { get; set; } = new() { Format = "OnSite" };
}
