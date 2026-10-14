using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Settings;

namespace EY.HRPlatform.Performance.Domain.Reviews;

public enum ReviewItemKind { Objective, Competency }

/// <summary>Formal review input for one live objective or snapshotted competency.</summary>
public sealed class ReviewItemResponse : PerformanceChildEntity
{
    private ReviewItemResponse() { }

    public Guid ReviewId { get; private set; }
    public ReviewItemKind Kind { get; private set; }
    public Guid ItemId { get; private set; }
    public string? SelfReflection { get; private set; }
    public int? SelfRating { get; private set; }
    public string? SelfComment { get; private set; }
    public string? ManagerAssessment { get; private set; }
    public int? ManagerRating { get; private set; }

    public static ReviewItemResponse Create(Guid tenantId, Guid reviewId, ReviewItemKind kind, Guid itemId)
    {
        if (tenantId == Guid.Empty || reviewId == Guid.Empty || itemId == Guid.Empty)
            throw new ArgumentException("A review item requires tenant, review, and source item identities.");
        return new ReviewItemResponse { TenantId = tenantId, ReviewId = reviewId, Kind = kind, ItemId = itemId };
    }

    public void SaveSelf(string? reflection, int? rating, string? comment)
    {
        SelfReflection = Normalize(reflection, 4000, nameof(reflection));
        SelfRating = rating;
        SelfComment = Normalize(comment, 2000, nameof(comment));
        MarkUpdated();
    }

    public void SaveManager(string? assessment, int? rating)
    {
        ManagerAssessment = Normalize(assessment, 4000, nameof(assessment));
        ManagerRating = rating;
        MarkUpdated();
    }

    private static string? Normalize(string? value, int max, string parameter)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var cleaned = value.Trim();
        if (cleaned.Length > max) throw new ArgumentException($"An item response cannot exceed {max} characters.", parameter);
        return cleaned;
    }
}
