namespace EY.HRPlatform.Interview.Models.Candidates;

/// <summary>A synthesized, decision-oriented view of a single graded attempt: raw score + pass mark,
/// a per-skill breakdown (grouped by question tags, or question type when tags are sparse), an optional
/// cohort benchmark, and the reused proctoring roll-up. The hiring <em>verdict</em> is intentionally NOT
/// computed here — it is derived on the client from score + proctoring so the rule stays visible and tweakable
/// in the reviewer UI.</summary>
public class CandidateReportDto
{
    public string TestId { get; set; } = string.Empty;
    public string TestTitle { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public int AttemptNumber { get; set; }
    public string? AttemptId { get; set; }

    public string GradingStatus { get; set; } = "Pending";
    public decimal? TotalScore { get; set; }
    public decimal? MaxScore { get; set; }
    /// <summary>Author-set pass mark (0–100), or null when the test has none configured.</summary>
    public int? PassingThreshold { get; set; }
    public string? SubmittedAtUtc { get; set; }

    /// <summary>Total time on the attempt in seconds, aggregated from per-question timing captured in
    /// AnswersJson. Null for attempts submitted before timing capture shipped.</summary>
    public int? TotalDurationSeconds { get; set; }

    /// <summary>Which axis the skills are grouped by: "tag" when the attempt has ≥3 distinct question
    /// tags, otherwise "type" (question type). Lets the UI label the profile correctly.</summary>
    public string AxisKind { get; set; } = "tag";

    /// <summary>Number of graded attempts that make up the benchmark cohort for this test.</summary>
    public int CohortSize { get; set; }
    /// <summary>True when the cohort is large enough (≥ the floor) for benchmarking to be shown.</summary>
    public bool CohortAvailable { get; set; }
    /// <summary>Plain-language reason benchmarking is unavailable (null when it is available).</summary>
    public string? CohortUnavailableReason { get; set; }
    /// <summary>Cohort mean of overall score as a percentage, or null when the cohort is too small.</summary>
    public double? OverallCohortAvgPct { get; set; }

    public List<CandidateReportSkillDto> Skills { get; set; } = [];

    /// <summary>Reused attempt proctoring roll-up; null when proctoring neither ran nor left evidence.</summary>
    public CandidateAttemptProctoringSummaryDto? Proctoring { get; set; }
}

public class CandidateReportSkillDto
{
    /// <summary>Axis label — a question tag (e.g. "algorithms") or a question-type name.</summary>
    public string Key { get; set; } = string.Empty;
    /// <summary>Candidate's score on this axis as a percentage (points earned / points available).</summary>
    public double ScorePct { get; set; }
    /// <summary>Cohort mean on this axis as a percentage, or null when benchmarking is unavailable
    /// or too few of the cohort's attempts covered this axis to clear the benchmark floor — an axis
    /// can be much thinner than the cohort as a whole.</summary>
    public double? CohortAvgPct { get; set; }
    /// <summary>Seconds the candidate spent on this axis, or null when timing was not captured.</summary>
    public int? SecondsSpent { get; set; }
    /// <summary>Sum of the axis's questions' allotted durations, in seconds (the time budget).</summary>
    public int AllottedSeconds { get; set; }
    /// <summary>How many of the attempt's questions contributed to this axis.</summary>
    public int QuestionCount { get; set; }
}
