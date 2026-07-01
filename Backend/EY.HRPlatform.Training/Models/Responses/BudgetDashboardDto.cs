namespace EY.HRPlatform.Training.Models.Responses;

public class BudgetDashboardSummaryDto
{
    public decimal TotalAllocated { get; set; }
    public decimal TotalSpent { get; set; }
    public decimal TotalRemaining { get; set; }
    public decimal PercentConsumed { get; set; }
    public List<BudgetByServiceLineDto> ByServiceLine { get; set; } = [];
    public List<BudgetServiceLineAlertDto> Alerts { get; set; } = [];
}

public class BudgetByServiceLineDto
{
    public Guid ServiceLineId { get; set; }
    public string ServiceLineName { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public decimal Allocated { get; set; }
    public decimal Spent { get; set; }
    public decimal Remaining { get; set; }
    public decimal PercentConsumed { get; set; }
}

public class BudgetServiceLineAlertDto
{
    public Guid ServiceLineId { get; set; }
    public string ServiceLineName { get; set; } = string.Empty;
    public decimal PercentConsumed { get; set; }
    public int ThresholdBand { get; set; } // 80 / 90 / 100
}

public class BudgetTrendDto
{
    public List<BudgetTrendPointDto> Points { get; set; } = [];
}

public class BudgetTrendPointDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Label { get; set; } = string.Empty;
    public decimal Spend { get; set; }
}

public class BudgetSpendDetailDto
{
    public Guid ServiceLineId { get; set; }
    public string ServiceLineName { get; set; } = string.Empty;
    public List<BudgetSpendDetailRowDto> Rows { get; set; } = [];
}

public class BudgetSpendDetailRowDto
{
    public Guid SessionId { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public decimal Amount { get; set; }
    public string? TrainerName { get; set; }
}
