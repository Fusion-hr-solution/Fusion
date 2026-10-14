using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Settings;

namespace EY.HRPlatform.Performance.Tests;

public sealed class EvidenceRetentionTests
{
    [Fact]
    public void Settings_default_to_36_months_and_reject_non_positive_retention()
    {
        var settings = CycleSettings.CreateDefault(Guid.NewGuid());
        Assert.Equal(36, settings.EvidenceRetentionMonths);

        Assert.Throws<ArgumentOutOfRangeException>(() => settings.Update(
            settings.DefaultMeasurementMethod,
            settings.SuggestedObjectiveCountMin,
            settings.SuggestedObjectiveCountMax,
            settings.PlanningDeadlineOffsetDays,
            settings.PlanAlignmentPolicy,
            evidenceRetentionMonths: 0));
    }

    [Fact]
    public void Expiry_starts_at_the_month_anniversary_and_only_closed_cycles_have_a_close_date()
    {
        var closedAt = new DateTime(2023, 1, 31, 12, 0, 0, DateTimeKind.Utc);
        var expiry = closedAt.AddMonths(36);

        Assert.False(EvidenceRetentionPolicy.IsExpired(closedAt, 36, expiry.AddTicks(-1)));
        Assert.True(EvidenceRetentionPolicy.IsExpired(closedAt, 36, expiry));
        Assert.True(EvidenceRetentionPolicy.IsExpired(closedAt, 36, expiry.AddTicks(1)));
        Assert.False(EvidenceRetentionPolicy.IsExpired(closedAt, 36, closedAt));
    }

    [Fact]
    public void Retention_removal_clears_file_metadata_but_keeps_the_evidence_record()
    {
        var item = EvidenceItem.File(Guid.NewGuid(), "Review.pdf", "application/pdf", 42, "tenant/file.pdf");
        item.RemoveUnderRetention();

        Assert.Equal(EvidenceKind.File, item.Kind);
        Assert.True(item.IsRemovedUnderRetention);
        Assert.Null(item.FileName);
        Assert.Null(item.ContentType);
        Assert.Null(item.SizeBytes);
        Assert.Null(item.StorageKey);
    }
}
