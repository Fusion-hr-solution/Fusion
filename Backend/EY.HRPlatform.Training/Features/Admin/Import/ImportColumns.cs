namespace EY.HRPlatform.Training.Features.Admin.Import;

/// <summary>A column in the training import workbook. Required columns get a highlighted header.</summary>
public record ImportColumn(string Name, bool Required);

/// <summary>
/// Canonical column contract for the multi-sheet training import workbook (US-8.2.3/8.2.4, ADR 0008).
/// Shared by the template generator and the parser so they never drift. Child rows reference their
/// parent training by the spreadsheet-local "Ref" (Import Ref).
/// </summary>
public static class ImportColumns
{
    public const string TrainingsSheet = "Trainings";
    public const string SessionsSheet = "Sessions";
    public const string ChaptersSheet = "Chapters";
    public const string ContentSheet = "Content";
    public const string InstructionsSheet = "Instructions";
    public const string ListsSheet = "Lists";

    // Dropdown value sets (display values; the parser maps these to enums).
    public static readonly string[] Formats = ["E-learning", "On-site"];
    public static readonly string[] BadgeLevels = ["Bronze", "Silver", "Gold"];
    public static readonly string[] ContentTypes = ["Article", "Video", "Pdf", "Exercise"];
    public static readonly string[] Layouts = ["SingleContent", "SplitLayout", "MultiSection"];

    public static readonly ImportColumn[] Trainings =
    [
        new("Ref", true),
        new("Title", true),
        new("Description", false),
        new("Category", true),
        new("Format", true),
        new("Credits", true),
        new("Badge Level", true),
        new("Duration", false),
        new("Mandatory", false),
    ];

    public static readonly ImportColumn[] Sessions =
    [
        new("Training Ref", true),
        new("Part Title", true),
        new("Start (UTC)", true),
        new("End (UTC)", true),
        new("Room", false),
        new("Capacity", true),
        new("Trainer Email", false),
        new("Trainer Name", false),
    ];

    public static readonly ImportColumn[] Chapters =
    [
        new("Training Ref", true),
        new("Chapter Title", true),
        new("Order", true),
        new("Layout", false),
    ];

    public static readonly ImportColumn[] Content =
    [
        new("Training Ref", true),
        new("Chapter Title", true),
        new("Type", true),
        new("Title", false),
        new("Text", false),
        new("URL", false),
        new("Duration (min)", false),
        new("Order", false),
    ];
}
