using EY.HRPlatform.Performance.Domain.Reviews;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ReviewRoundConfiguration : IEntityTypeConfiguration<ReviewRound>
{
    public void Configure(EntityTypeBuilder<ReviewRound> builder)
    {
        builder.ToTable("ReviewRounds");
        builder.HasKey(round => round.Id);
        builder.Property(round => round.Version).IsRowVersion();
        builder.Property(round => round.Name).IsRequired().HasMaxLength(200);
        builder.Property(round => round.State).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(round => round.CompetencyIdsJson).HasColumnType("jsonb").IsRequired();
        builder.Property(round => round.ConfigSnapshotJson).HasColumnType("jsonb");
        builder.Property(round => round.SelfAssessmentDueDays).HasDefaultValue(14);
        builder.Property(round => round.PeerInputDueDays).HasDefaultValue(14);
        builder.Property(round => round.ManagerAssessmentDueDays).HasDefaultValue(7);
        builder.Property(round => round.AcknowledgementReminderDays).HasDefaultValue(7);
        builder.Navigation(round => round.Questions).HasField("_questions");
        builder.HasIndex(round => round.TenantId);
        builder.HasIndex(round => new { round.TenantId, round.CycleId });
        builder.HasIndex(round => round.ActiveCycleSlot).IsUnique().HasFilter("\"ActiveCycleSlot\" IS NOT NULL");
        builder.HasOne<Domain.Cycles.PerformanceCycle>().WithMany().HasForeignKey(round => round.CycleId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Domain.Settings.RatingScaleVersion>().WithMany().HasForeignKey(round => round.RatingScaleVersionId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> builder)
    {
        builder.ToTable("PerformanceReviews");
        builder.HasKey(review => review.Id);
        builder.Property(review => review.Version).IsRowVersion();
        builder.Property(review => review.SubjectDisplayName).IsRequired().HasMaxLength(300);
        builder.Property(review => review.SubjectJobTitle).HasMaxLength(300);
        builder.Property(review => review.SubjectOrgUnitName).HasMaxLength(300);
        builder.Property(review => review.ReviewerBasis).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(review => review.ReviewerDisplayName).IsRequired().HasMaxLength(300);
        builder.Property(review => review.RatingScaleSnapshotJson).HasColumnType("jsonb").IsRequired();
        builder.Property(review => review.FinalizedSnapshotJson).HasColumnType("jsonb");
        builder.Property(review => review.FinalRatingSource).HasMaxLength(30);
        builder.Property(review => review.CloseReason).HasMaxLength(1000);
        builder.Property(review => review.State).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(review => review.Potential).HasConversion<string>().HasMaxLength(20);
        builder.Property(review => review.AcknowledgementComment).HasMaxLength(PerformanceReview.MaxAcknowledgementComment);
        builder.Navigation(review => review.Answers).HasField("_answers");
        builder.Navigation(review => review.PeerNominations).HasField("_peerNominations");
        builder.OwnsOne(review => review.SelfAssessment, assessment =>
        {
            assessment.Ignore(value => value.IsSubmitted);
            assessment.Property(value => value.Summary).HasColumnName("SelfAssessmentSummary").HasMaxLength(4000).IsRequired();
            assessment.Property(value => value.OverallRating).HasColumnName("SelfAssessmentOverallRating");
            assessment.Property(value => value.SavedAt).HasColumnName("SelfAssessmentSavedAt");
            assessment.Property(value => value.SubmittedAt).HasColumnName("SelfAssessmentSubmittedAt");
        });
        builder.OwnsOne(review => review.ManagerAssessment, assessment =>
        {
            assessment.Ignore(value => value.IsSubmitted);
            assessment.Property(value => value.Summary).HasColumnName("ManagerAssessmentSummary").HasMaxLength(4000).IsRequired();
            assessment.Property(value => value.OverallRating).HasColumnName("ManagerAssessmentOverallRating");
            assessment.Property(value => value.SavedAt).HasColumnName("ManagerAssessmentSavedAt");
            assessment.Property(value => value.SubmittedAt).HasColumnName("ManagerAssessmentSubmittedAt");
        });
        builder.HasIndex(review => review.TenantId);
        builder.HasIndex(review => new { review.TenantId, review.ReviewRoundId, review.SubjectEmployeeId }).IsUnique();
        builder.HasIndex(review => new { review.TenantId, review.CycleId, review.State });
        builder.HasIndex(review => review.ReviewerEmployeeId);
        builder.HasOne<ReviewRound>().WithMany().HasForeignKey(review => review.ReviewRoundId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Domain.Settings.RatingScaleVersion>().WithMany().HasForeignKey(review => review.RatingScaleVersionId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ReviewRoundSubjectConfiguration : IEntityTypeConfiguration<ReviewRoundSubject>
{
    public void Configure(EntityTypeBuilder<ReviewRoundSubject> builder)
    {
        builder.ToTable("ReviewRoundSubjects");
        builder.HasKey(subject => subject.Id);
        builder.Property(subject => subject.SubjectDisplayName).IsRequired().HasMaxLength(300);
        builder.Property(subject => subject.ReviewerDisplayName).HasMaxLength(300);
        builder.Property(subject => subject.ReviewerBasis).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(subject => subject.ExclusionReason).HasMaxLength(1000);
        builder.HasIndex(subject => subject.TenantId);
        builder.HasIndex(subject => new { subject.TenantId, subject.ReviewRoundId, subject.ParticipantId }).IsUnique();
        builder.HasIndex(subject => new { subject.TenantId, subject.ReviewRoundId, subject.SubjectEmployeeId }).IsUnique();
        builder.HasOne<ReviewRound>().WithMany().HasForeignKey(subject => subject.ReviewRoundId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Domain.Population.Participant>().WithMany().HasForeignKey(subject => subject.ParticipantId).OnDelete(DeleteBehavior.Restrict);
    }
}
