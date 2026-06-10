namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// Personal in-person training hours for the current employee.
/// Includes totals over multiple time windows, a breakdown of attended sessions,
/// and the in-person vs e-learning hours ratio for the pie-chart widget.
/// </summary>
public class MyInPersonHoursDto
{
    public double TotalHoursYear { get; set; }
    public double TotalHoursQuarter { get; set; }
    public double TotalHoursMonth { get; set; }
    public double TotalHoursAllTime { get; set; }

    /// <summary>In-person attended hours (all time) for the ratio chart.</summary>
    public double InPersonHours { get; set; }

    /// <summary>Estimated e-learning hours derived from completed trainings (all time).</summary>
    public double ELearningHours { get; set; }

    public List<AttendedSessionItem> AttendedSessions { get; set; } = [];
}

public class AttendedSessionItem
{
    public Guid SessionId { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public double Hours { get; set; }
}
