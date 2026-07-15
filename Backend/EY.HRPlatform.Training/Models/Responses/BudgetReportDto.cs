namespace EY.HRPlatform.Training.Models.Responses;

public class BudgetReportDto
{
    public string PeriodLabel { get; set; } = "All time";
    public string ServiceLineFilter { get; set; } = "All service lines";
    public decimal TotalAllocated { get; set; }
    public decimal TotalSpent { get; set; }
    public decimal TotalRemaining { get; set; }
    public decimal PercentConsumed { get; set; }
    public List<BudgetByServiceLineDto> ServiceLines { get; set; } = [];
    public List<BudgetReportDetailRowDto> Detail { get; set; } = [];
}

public class BudgetReportDetailRowDto
{
    public string ServiceLineName { get; set; } = string.Empty;
    public string TrainingTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public decimal Amount { get; set; }
    public string? TrainerName { get; set; }
}
