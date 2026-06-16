using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Budget.Export;

/// <summary>Generates external-training budget report files (Excel / PDF).</summary>
public interface IBudgetReportExporter
{
    byte[] ToExcel(BudgetReportDto data);
    byte[] ToPdf(BudgetReportDto data);
}
