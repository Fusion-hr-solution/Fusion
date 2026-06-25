using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Reports.Export;

/// <summary>One applied-filter line shown in a report's Excel header (US-8.2.1/8.2.2).</summary>
public record ReportFilterLine(string Label, string Value);

/// <summary>Generates report export files. Excel only for now; PDF (with charts) follows in Slice 2.</summary>
public interface IReportExporter
{
    byte[] AttendanceByEmployeeToExcel(
        IReadOnlyList<AttendanceByEmployeeRowDto> rows, IReadOnlyList<ReportFilterLine> filters);

    byte[] TrainingHoursByEmployeeToExcel(
        IReadOnlyList<TrainingHoursRowDto> rows, IReadOnlyList<ReportFilterLine> filters);

    byte[] FormatComparisonToExcel(
        FormatComparisonDto data, IReadOnlyList<ReportFilterLine> filters);
}
