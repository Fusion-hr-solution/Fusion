namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// Full text payload for a training, for internal service-to-service ingestion
/// (e.g. the AI service's RAG indexer). Returns every chapter and content block;
/// the consumer decides which block types to index (today: Article text).
/// </summary>
public class InternalTrainingContentDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public List<InternalChapterContentDto> Chapters { get; set; } = [];
}

public class InternalChapterContentDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public List<InternalContentBlockDto> Blocks { get; set; } = [];
}

public class InternalContentBlockDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;   // ContentType: Video | Pdf | Article | Exercise
    public int OrderIndex { get; set; }
    public string? Title { get; set; }
    public string? TextContent { get; set; }
    public string? ContentUri { get; set; }             // Pdf/Video asset path (for PDF text extraction)
}
