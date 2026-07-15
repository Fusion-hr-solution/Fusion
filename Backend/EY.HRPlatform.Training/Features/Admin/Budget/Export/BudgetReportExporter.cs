using ClosedXML.Excel;
using EY.HRPlatform.Training.Models.Responses;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace EY.HRPlatform.Training.Features.Admin.Budget.Export;

/// <summary>
/// Budget report exporter using ClosedXML (Excel: Summary + Detail sheets) and QuestPDF (branded PDF).
/// Mirrors the SessionParticipantExporter pattern. Amounts are in TND.
/// </summary>
public class BudgetReportExporter : IBudgetReportExporter
{
    public byte[] ToExcel(BudgetReportDto data)
    {
        ArgumentNullException.ThrowIfNull(data);

        using var workbook = new XLWorkbook();

        // ── Summary sheet ───────────────────────────────────────────────────
        var ws = workbook.Worksheets.Add("Summary");
        ws.Cell(1, 1).Value = "Training Budget Report";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;

        ws.Cell(2, 1).Value = "Service Line";
        ws.Cell(2, 2).Value = data.ServiceLineFilter;
        ws.Cell(3, 1).Value = "Period";
        ws.Cell(3, 2).Value = data.PeriodLabel;
        ws.Cell(4, 1).Value = "Total Allocated (TND)";
        ws.Cell(4, 2).Value = data.TotalAllocated;
        ws.Cell(5, 1).Value = "Total Spent (TND)";
        ws.Cell(5, 2).Value = data.TotalSpent;
        ws.Cell(6, 1).Value = "Total Remaining (TND)";
        ws.Cell(6, 2).Value = data.TotalRemaining;
        ws.Cell(7, 1).Value = "Consumed %";
        ws.Cell(7, 2).Value = data.PercentConsumed;
        ws.Range(2, 1, 7, 1).Style.Font.Bold = true;

        const int headerRow = 9;
        var headers = new[] { "Service Line", "Allocated (TND)", "Spent (TND)", "Remaining (TND)", "Consumed %" };
        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(headerRow, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }

        for (int i = 0; i < data.ServiceLines.Count; i++)
        {
            var r = data.ServiceLines[i];
            var row = headerRow + 1 + i;
            ws.Cell(row, 1).Value = r.ServiceLineName;
            ws.Cell(row, 2).Value = r.Allocated;
            ws.Cell(row, 3).Value = r.Spent;
            ws.Cell(row, 4).Value = r.Remaining;
            ws.Cell(row, 5).Value = r.PercentConsumed;
        }

        ws.Columns().AdjustToContents();

        // ── Detail sheet ────────────────────────────────────────────────────
        var ds = workbook.Worksheets.Add("Detail");
        var detailHeaders = new[] { "Service Line", "Training", "Date", "Paid To", "Amount (TND)" };
        for (int i = 0; i < detailHeaders.Length; i++)
        {
            var cell = ds.Cell(1, i + 1);
            cell.Value = detailHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }

        for (int i = 0; i < data.Detail.Count; i++)
        {
            var d = data.Detail[i];
            var row = 2 + i;
            ds.Cell(row, 1).Value = d.ServiceLineName;
            ds.Cell(row, 2).Value = d.TrainingTitle;
            ds.Cell(row, 3).Value = d.StartUtc;
            ds.Cell(row, 3).Style.DateFormat.Format = "yyyy-MM-dd";
            ds.Cell(row, 4).Value = d.TrainerName ?? "—";
            ds.Cell(row, 5).Value = d.Amount;
        }

        ds.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] ToPdf(BudgetReportDto data)
    {
        ArgumentNullException.ThrowIfNull(data);

        QuestPDF.Settings.License = LicenseType.Community;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(30);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(t => t.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("Training Budget Report").FontSize(16).SemiBold();
                    col.Item().Text($"Service line: {data.ServiceLineFilter}  ·  Period: {data.PeriodLabel}")
                        .FontSize(9).FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(4)
                        .Text($"Allocated {data.TotalAllocated:N3} TND · Spent {data.TotalSpent:N3} TND · Remaining {data.TotalRemaining:N3} TND · {data.PercentConsumed:N1}% consumed")
                        .FontSize(9).FontColor(Colors.Grey.Darken2);
                });

                page.Content().PaddingTop(15).Column(col =>
                {
                    col.Item().Text("By Service Line").SemiBold();
                    col.Item().PaddingTop(4).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(3); c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2);
                        });
                        table.Header(h =>
                        {
                            foreach (var c in new[] { "Service Line", "Allocated", "Spent", "Remaining", "Consumed %" })
                                h.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text(c).SemiBold();
                        });
                        foreach (var r in data.ServiceLines)
                        {
                            table.Cell().Padding(4).Text(r.ServiceLineName);
                            table.Cell().Padding(4).Text($"{r.Allocated:N3}");
                            table.Cell().Padding(4).Text($"{r.Spent:N3}");
                            table.Cell().Padding(4).Text($"{r.Remaining:N3}");
                            table.Cell().Padding(4).Text($"{r.PercentConsumed:N1}%");
                        }
                    });

                    col.Item().PaddingTop(16).Text("Spending Detail").SemiBold();
                    col.Item().PaddingTop(4).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(2); c.RelativeColumn(3); c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2);
                        });
                        table.Header(h =>
                        {
                            foreach (var c in new[] { "Service Line", "Training", "Date", "Paid To", "Amount" })
                                h.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text(c).SemiBold();
                        });
                        foreach (var d in data.Detail)
                        {
                            table.Cell().Padding(4).Text(d.ServiceLineName);
                            table.Cell().Padding(4).Text(d.TrainingTitle);
                            table.Cell().Padding(4).Text(d.StartUtc.ToString("yyyy-MM-dd"));
                            table.Cell().Padding(4).Text(d.TrainerName ?? "—");
                            table.Cell().Padding(4).Text($"{d.Amount:N3}");
                        }
                    });
                });

                page.Footer().AlignRight().Text(t =>
                {
                    t.Span("Page ");
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }
}
