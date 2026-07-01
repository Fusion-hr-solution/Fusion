namespace EY.HRPlatform.Training.Models.Requests;

/// <summary>A chart rasterised to PNG by the browser, sent to be embedded in a report PDF (ADR 0007).</summary>
public record ReportChartImage(string Key, string PngBase64);

/// <summary>
/// US-8.2.1/8.2.2 PDF export body. Carries the same filters as the Excel GET (plus display labels for
/// the header) and the on-screen charts rasterised to PNG client-side, which the server embeds.
/// </summary>
public record ReportPdfRequest(
    Guid? GradeId,
    Guid? ServiceLineId,
    Guid? TrainingId,
    DateTime? From,
    DateTime? To,
    string? GradeLabel,
    string? ServiceLineLabel,
    string? TrainingLabel,
    List<ReportChartImage>? Charts);
