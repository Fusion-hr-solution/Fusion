using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateTrainingBudgetRequest
{
    // ServiceLineId is immutable — re-key by deleting and recreating the budget.
    [Required, MaxLength(20)]
    public string PeriodType { get; set; } = "Annual";

    [Required]
    public DateTime PeriodStart { get; set; }

    [Required]
    public DateTime PeriodEnd { get; set; }

    [Range(0, double.MaxValue)]
    public decimal AllocatedAmount { get; set; }
}
