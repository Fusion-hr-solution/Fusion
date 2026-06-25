using ClosedXML.Excel;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Reports.Export;

/// <summary>
/// ClosedXML implementation of <see cref="IReportExporter"/> — one data sheet per report, a header
/// echoing the applied filters, and a totals row. Mirrors the SessionParticipantExporter styling.
/// </summary>
public class ReportExporter : IReportExporter
{
    public byte[] AttendanceByEmployeeToExcel(
        IReadOnlyList<AttendanceByEmployeeRowDto> rows, IReadOnlyList<ReportFilterLine> filters)
    {
        ArgumentNullException.ThrowIfNull(rows);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Attendance");
        var headerRow = WriteHeader(ws, "Attendance Report", filters);

        var headers = new[] { "#", "Employee", "Email", "Grade", "Service Line", "Sessions Enrolled", "Attended", "Missed", "Attendance Rate %" };
        WriteTableHeader(ws, headerRow, headers);

        for (int i = 0; i < rows.Count; i++)
        {
            var r = rows[i];
            var row = headerRow + 1 + i;
            ws.Cell(row, 1).Value = i + 1;
            ws.Cell(row, 2).Value = r.EmployeeName ?? "—";
            ws.Cell(row, 3).Value = r.Email ?? "—";
            ws.Cell(row, 4).Value = r.GradeName;
            ws.Cell(row, 5).Value = r.ServiceLineName;
            ws.Cell(row, 6).Value = r.SessionsEnrolled;
            ws.Cell(row, 7).Value = r.Attended;
            ws.Cell(row, 8).Value = r.Missed;
            ws.Cell(row, 9).Value = r.AttendanceRate;
        }

        var totalsRow = headerRow + 1 + rows.Count;
        var totalAttended = rows.Sum(r => r.Attended);
        var totalMissed = rows.Sum(r => r.Missed);
        ws.Cell(totalsRow, 2).Value = "Total";
        ws.Cell(totalsRow, 6).Value = rows.Sum(r => r.SessionsEnrolled);
        ws.Cell(totalsRow, 7).Value = totalAttended;
        ws.Cell(totalsRow, 8).Value = totalMissed;
        ws.Cell(totalsRow, 9).Value = totalAttended + totalMissed > 0
            ? Math.Round((double)totalAttended / (totalAttended + totalMissed) * 100, 1)
            : 0;
        ws.Range(totalsRow, 1, totalsRow, headers.Length).Style.Font.Bold = true;

        ws.Columns().AdjustToContents();
        return Save(workbook);
    }

    public byte[] TrainingHoursByEmployeeToExcel(
        IReadOnlyList<TrainingHoursRowDto> rows, IReadOnlyList<ReportFilterLine> filters)
    {
        ArgumentNullException.ThrowIfNull(rows);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Training Hours");
        var headerRow = WriteHeader(ws, "Training Hours Report (estimated)", filters);

        var headers = new[] { "#", "Employee", "Grade", "Service Line", "E-learning Hours", "In-person Hours", "Total Hours", "Trainings Completed" };
        WriteTableHeader(ws, headerRow, headers);

        for (int i = 0; i < rows.Count; i++)
        {
            var r = rows[i];
            var row = headerRow + 1 + i;
            ws.Cell(row, 1).Value = i + 1;
            ws.Cell(row, 2).Value = r.EmployeeName ?? "—";
            ws.Cell(row, 3).Value = r.GradeName;
            ws.Cell(row, 4).Value = r.ServiceLineName;
            ws.Cell(row, 5).Value = r.ELearningHours;
            ws.Cell(row, 6).Value = r.InPersonHours;
            ws.Cell(row, 7).Value = r.TotalHours;
            ws.Cell(row, 8).Value = r.TrainingsCompleted;
        }

        var totalsRow = headerRow + 1 + rows.Count;
        ws.Cell(totalsRow, 2).Value = "Total";
        ws.Cell(totalsRow, 5).Value = Math.Round(rows.Sum(r => r.ELearningHours), 2);
        ws.Cell(totalsRow, 6).Value = Math.Round(rows.Sum(r => r.InPersonHours), 2);
        ws.Cell(totalsRow, 7).Value = Math.Round(rows.Sum(r => r.TotalHours), 2);
        ws.Cell(totalsRow, 8).Value = rows.Sum(r => r.TrainingsCompleted);
        ws.Range(totalsRow, 1, totalsRow, headers.Length).Style.Font.Bold = true;

        ws.Columns().AdjustToContents();
        return Save(workbook);
    }

    public byte[] FormatComparisonToExcel(FormatComparisonDto data, IReadOnlyList<ReportFilterLine> filters)
    {
        ArgumentNullException.ThrowIfNull(data);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Format Comparison");
        var headerRow = WriteHeader(ws, "In-person vs E-learning Comparison", filters);

        var headers = new[] { "Format", "Trainings", "Hours Delivered", "Participants", "Completion Rate %", "Avg Feedback" };
        WriteTableHeader(ws, headerRow, headers);

        var formats = new[] { data.ELearning, data.OnSite };
        for (int i = 0; i < formats.Length; i++)
        {
            var m = formats[i];
            var row = headerRow + 1 + i;
            ws.Cell(row, 1).Value = m.Format == "ELearning" ? "E-learning" : "On-site";
            ws.Cell(row, 2).Value = m.TrainingCount;
            ws.Cell(row, 3).Value = m.HoursDelivered;
            ws.Cell(row, 4).Value = m.Participants;
            ws.Cell(row, 5).Value = m.CompletionRate;
            if (m.AvgFeedback.HasValue) ws.Cell(row, 6).Value = m.AvgFeedback.Value;
            else ws.Cell(row, 6).Value = "—";
        }

        ws.Columns().AdjustToContents();
        return Save(workbook);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static int WriteHeader(IXLWorksheet ws, string title, IReadOnlyList<ReportFilterLine> filters)
    {
        ws.Cell(1, 1).Value = title;
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;

        var row = 2;
        foreach (var filter in filters)
        {
            ws.Cell(row, 1).Value = filter.Label;
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Cell(row, 2).Value = filter.Value;
            row++;
        }

        return row + 1; // leave a blank line before the table
    }

    private static void WriteTableHeader(IXLWorksheet ws, int headerRow, string[] headers)
    {
        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(headerRow, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }
    }

    private static byte[] Save(XLWorkbook workbook)
    {
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
