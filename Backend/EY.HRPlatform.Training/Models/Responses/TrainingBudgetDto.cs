namespace EY.HRPlatform.Training.Models.Responses;

public class TrainingBudgetDto
{
    public Guid Id { get; set; }
    public Guid ServiceLineId { get; set; }
    public string PeriodType { get; set; } = string.Empty;
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public decimal AllocatedAmount { get; set; }

    // Derived at read time from external-session costs — never persisted.
    public decimal Spend { get; set; }
    public decimal Remaining { get; set; }
    public decimal Percentage { get; set; }
}
