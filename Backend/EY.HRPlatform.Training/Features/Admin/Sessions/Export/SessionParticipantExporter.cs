using ClosedXML.Excel;
using EY.HRPlatform.Training.Models.Responses;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Export;

/// <summary>
/// Default implementation of <see cref="ISessionParticipantExporter"/> using
/// ClosedXML for Excel and QuestPDF for PDF generation.
/// </summary>
public class SessionParticipantExporter : ISessionParticipantExporter
{
    public byte[] ToExcel(SessionParticipantExportDto data)
    {
        ArgumentNullException.ThrowIfNull(data);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Participants");

        // ── Header (session metadata) ───────────────────────────────────────
        ws.Cell(1, 1).Value = "Training";
        ws.Cell(1, 2).Value = data.TrainingTitle;
        ws.Cell(2, 1).Value = "Part";
        ws.Cell(2, 2).Value = data.PartTitle;
        ws.Cell(3, 1).Value = "Date";
        ws.Cell(3, 2).Value = data.StartUtc.ToString("yyyy-MM-dd HH:mm") + " UTC";
        ws.Cell(4, 1).Value = "Room";
        ws.Cell(4, 2).Value = data.Room;
        ws.Cell(5, 1).Value = "Trainer";
        ws.Cell(5, 2).Value = data.TrainerName ?? "—";
        ws.Cell(6, 1).Value = "Capacity";
        ws.Cell(6, 2).Value = $"{data.Participants.Count} / {data.MaxCapacity}";

        ws.Range(1, 1, 6, 1).Style.Font.Bold = true;

        // ── Table header ────────────────────────────────────────────────────
        const int headerRow = 8;
        var headers = new[] { "#", "Full Name", "Email", "Grade", "Service Line", "Enrollment Date", "Status" };
        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(headerRow, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }

        // ── Data rows ───────────────────────────────────────────────────────
        for (int i = 0; i < data.Participants.Count; i++)
        {
            var p = data.Participants[i];
            var row = headerRow + 1 + i;
            ws.Cell(row, 1).Value = i + 1;
            ws.Cell(row, 2).Value = p.FullName;
            ws.Cell(row, 3).Value = p.Email;
            ws.Cell(row, 4).Value = p.Grade ?? "—";
            ws.Cell(row, 5).Value = p.ServiceLine ?? "—";
            ws.Cell(row, 6).Value = p.EnrollmentDate;
            ws.Cell(row, 6).Style.DateFormat.Format = "yyyy-MM-dd";
            ws.Cell(row, 7).Value = p.AttendanceStatus;
        }

        ws.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] ToPdf(SessionParticipantExportDto data)
    {
        ArgumentNullException.ThrowIfNull(data);

        // QuestPDF community license – set once per process is also valid in Program.cs;
        // setting here keeps the exporter self-contained.
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
                    col.Item().Text(data.TrainingTitle).FontSize(16).SemiBold();
                    col.Item().Text(data.PartTitle).FontSize(11).FontColor(Colors.Grey.Darken2);
                    col.Item().PaddingTop(4).Text($"{data.StartUtc:yyyy-MM-dd HH:mm} – {data.EndUtc:HH:mm} UTC · Room {data.Room} · Trainer: {data.TrainerName ?? "—"}")
                        .FontSize(9).FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingTop(15).Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.ConstantColumn(25);   // #
                        c.RelativeColumn(3);    // Name
                        c.RelativeColumn(4);    // Email
                        c.RelativeColumn(2);    // Grade
                        c.RelativeColumn(2);    // Service Line
                        c.RelativeColumn(2);    // Enrollment Date
                        c.RelativeColumn(2);    // Status
                    });

                    table.Header(header =>
                    {
                        var cells = new[] { "#", "Full Name", "Email", "Grade", "Service Line", "Enrolled", "Status" };
                        foreach (var c in cells)
                        {
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text(c).SemiBold();
                        }
                    });

                    for (int i = 0; i < data.Participants.Count; i++)
                    {
                        var p = data.Participants[i];
                        table.Cell().Padding(4).Text((i + 1).ToString());
                        table.Cell().Padding(4).Text(p.FullName);
                        table.Cell().Padding(4).Text(p.Email);
                        table.Cell().Padding(4).Text(p.Grade ?? "—");
                        table.Cell().Padding(4).Text(p.ServiceLine ?? "—");
                        table.Cell().Padding(4).Text(p.EnrollmentDate.ToString("yyyy-MM-dd"));
                        table.Cell().Padding(4).Text(p.AttendanceStatus);
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
