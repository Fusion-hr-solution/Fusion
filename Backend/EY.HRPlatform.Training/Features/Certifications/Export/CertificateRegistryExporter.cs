using ClosedXML.Excel;
using EY.HRPlatform.Training.Models.Responses;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace EY.HRPlatform.Training.Features.Certifications.Export;

/// <summary>ClosedXML (Excel) + QuestPDF (PDF) rendering of the certificate registry.</summary>
public class CertificateRegistryExporter : ICertificateRegistryExporter
{
    private static readonly string[] Headers =
        { "#", "Certificate №", "Employee", "Grade", "Service Line", "Training", "Credits", "Completed", "Issued", "Status" };

    public byte[] ToExcel(IReadOnlyList<CertificateRegistryDto> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Certificates");

        ws.Cell(1, 1).Value = "EY Academy — Certificate Registry";
        ws.Range(1, 1, 1, Headers.Length).Merge().Style.Font.SetBold().Font.SetFontSize(14);
        ws.Cell(2, 1).Value = $"Exported {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC · {rows.Count} certificate(s)";

        const int headerRow = 4;
        for (int i = 0; i < Headers.Length; i++)
        {
            var cell = ws.Cell(headerRow, i + 1);
            cell.Value = Headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }

        for (int i = 0; i < rows.Count; i++)
        {
            var r = rows[i];
            var row = headerRow + 1 + i;
            ws.Cell(row, 1).Value = i + 1;
            ws.Cell(row, 2).Value = r.CertificateNumber;
            ws.Cell(row, 3).Value = r.EmployeeFullName;
            ws.Cell(row, 4).Value = r.GradeName ?? "—";
            ws.Cell(row, 5).Value = r.ServiceLineName ?? "—";
            ws.Cell(row, 6).Value = r.TrainingTitle;
            ws.Cell(row, 7).Value = r.Credits;
            ws.Cell(row, 8).Value = r.CompletedAt;
            ws.Cell(row, 8).Style.DateFormat.Format = "yyyy-MM-dd";
            ws.Cell(row, 9).Value = r.IssuedAt;
            ws.Cell(row, 9).Style.DateFormat.Format = "yyyy-MM-dd";
            ws.Cell(row, 10).Value = r.Status;
        }

        ws.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] ToPdf(IReadOnlyList<CertificateRegistryDto> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        QuestPDF.Settings.License = LicenseType.Community;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(24);
                page.DefaultTextStyle(t => t.FontSize(8));

                page.Header().Column(col =>
                {
                    col.Item().Text("EY Academy — Certificate Registry").FontSize(14).SemiBold();
                    col.Item().Text($"Exported {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC · {rows.Count} certificate(s)")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingTop(10).Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.ConstantColumn(20);   // #
                        c.RelativeColumn(2.4f);  // number
                        c.RelativeColumn(2);     // employee
                        c.RelativeColumn(1.4f);  // grade
                        c.RelativeColumn(1.6f);  // service line
                        c.RelativeColumn(2.4f);  // training
                        c.ConstantColumn(40);    // credits
                        c.RelativeColumn(1.2f);  // completed
                        c.RelativeColumn(1.2f);  // issued
                        c.RelativeColumn(1);     // status
                    });

                    table.Header(header =>
                    {
                        foreach (var h in Headers)
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text(h).SemiBold();
                    });

                    for (int i = 0; i < rows.Count; i++)
                    {
                        var r = rows[i];
                        table.Cell().Padding(3).Text((i + 1).ToString());
                        table.Cell().Padding(3).Text(r.CertificateNumber);
                        table.Cell().Padding(3).Text(r.EmployeeFullName);
                        table.Cell().Padding(3).Text(r.GradeName ?? "—");
                        table.Cell().Padding(3).Text(r.ServiceLineName ?? "—");
                        table.Cell().Padding(3).Text(r.TrainingTitle);
                        table.Cell().Padding(3).Text(r.Credits.ToString());
                        table.Cell().Padding(3).Text($"{r.CompletedAt:yyyy-MM-dd}");
                        table.Cell().Padding(3).Text($"{r.IssuedAt:yyyy-MM-dd}");
                        table.Cell().Padding(3).Text(r.Status);
                    }
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
