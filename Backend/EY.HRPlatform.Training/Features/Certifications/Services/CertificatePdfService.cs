using System.Globalization;
using System.Reflection;
using EY.HRPlatform.Training.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>
/// EY-branded certificate PDF, generated with QuestPDF. Content is English (EY global convention).
/// </summary>
public class CertificatePdfService : ICertificatePdfService
{
    private const string EyYellow = "#FFE600";
    private const string Ink = "#2E2E38";       // EY dark grey
    private const string Muted = "#747480";

    private static readonly byte[]? LogoBytes = LoadLogo();

    public byte[] Generate(Certification c, byte[] qrPng, string verificationUrl)
    {
        ArgumentNullException.ThrowIfNull(c);
        ArgumentNullException.ThrowIfNull(qrPng);

        QuestPDF.Settings.License = LicenseType.Community;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(t => t.FontSize(11).FontColor(Ink));

                page.Content().Border(2).BorderColor(EyYellow).Padding(28).Column(col =>
                {
                    col.Spacing(6);

                    // Header: logo + accent
                    col.Item().Row(row =>
                    {
                        if (LogoBytes is not null)
                            row.ConstantItem(110).Image(LogoBytes).FitWidth();
                        else
                            row.ConstantItem(110).Text("EY").FontSize(28).Bold();
                        row.RelativeItem().AlignRight().AlignMiddle()
                            .Text("Certificate of Completion").FontSize(13).FontColor(Muted).LetterSpacing(0.2f);
                    });

                    col.Item().PaddingVertical(2).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    // Body
                    col.Item().PaddingTop(18).AlignCenter().Text("This certifies that").FontSize(12).FontColor(Muted);
                    col.Item().AlignCenter().Text(c.EmployeeFullName).FontSize(30).Bold();

                    var subtitle = string.Join(" · ", new[] { c.GradeName, c.ServiceLineName }
                        .Where(s => !string.IsNullOrWhiteSpace(s)));
                    if (!string.IsNullOrWhiteSpace(subtitle))
                        col.Item().AlignCenter().Text(subtitle).FontSize(12).FontColor(Muted);

                    col.Item().PaddingTop(14).AlignCenter().Text("has successfully completed").FontSize(12).FontColor(Muted);
                    col.Item().AlignCenter().Text(c.TrainingTitle).FontSize(18).SemiBold();
                    if (!string.IsNullOrWhiteSpace(c.TrainingDescription))
                        col.Item().PaddingHorizontal(40).AlignCenter().Text(c.TrainingDescription!).FontSize(10).FontColor(Muted);

                    // Detail strip
                    col.Item().PaddingTop(22).Row(row =>
                    {
                        DetailCell(row, "Date of completion", c.CompletedAt.ToString("dd MMM yyyy", CultureInfo.InvariantCulture));
                        DetailCell(row, "Duration", string.IsNullOrWhiteSpace(c.Duration) ? "—" : c.Duration!);
                        DetailCell(row, "Trainer", string.IsNullOrWhiteSpace(c.TrainerName) ? "—" : c.TrainerName!);
                        DetailCell(row, "Credits", c.Credits.ToString(CultureInfo.InvariantCulture));
                    });

                    col.Item().PaddingTop(8).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    // Footer: number + QR
                    col.Item().PaddingTop(12).Row(row =>
                    {
                        row.RelativeItem().AlignMiddle().Column(meta =>
                        {
                            meta.Item().Text("Certificate number").FontSize(9).FontColor(Muted);
                            meta.Item().Text(c.CertificateNumber).FontSize(13).SemiBold();
                            meta.Item().PaddingTop(8).Text("Scan or visit to verify").FontSize(9).FontColor(Muted);
                            meta.Item().Text(verificationUrl).FontSize(9).FontColor(Ink);
                        });
                        row.ConstantItem(96).Image(qrPng);
                    });
                });
            });
        });

        return document.GeneratePdf();
    }

    private static void DetailCell(RowDescriptor row, string label, string value)
    {
        row.RelativeItem().AlignCenter().Column(col =>
        {
            col.Item().AlignCenter().Text(label).FontSize(9).FontColor(Muted);
            col.Item().AlignCenter().Text(value).FontSize(12).SemiBold();
        });
    }

    private static byte[]? LoadLogo()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var name = Array.Find(assembly.GetManifestResourceNames(), n => n.EndsWith("ey-logo.png", StringComparison.OrdinalIgnoreCase));
        if (name is null)
            return null;

        using var stream = assembly.GetManifestResourceStream(name);
        if (stream is null)
            return null;

        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }
}
