using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationAssignmentConfiguration : IEntityTypeConfiguration<EvaluationAssignment>
{
    public void Configure(EntityTypeBuilder<EvaluationAssignment> builder)
    {
        builder.ToTable("EvaluationAssignments");
        builder.HasKey(assignment => assignment.Id);
        builder.Property(assignment => assignment.Version).IsRowVersion();
        builder.Property(assignment => assignment.TenantId).IsRequired();
        builder.Property(assignment => assignment.RoundId).IsRequired();
        builder.Property(assignment => assignment.RoundParticipantId).IsRequired();
        builder.Property(assignment => assignment.ParticipantEmployeeId).IsRequired();
        builder.Property(assignment => assignment.ParticipantName).HasMaxLength(256).IsRequired();
        builder.Property(assignment => assignment.Kind).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(assignment => assignment.AssigneeEmployeeId).IsRequired();
        builder.Property(assignment => assignment.AssigneeName).HasMaxLength(256).IsRequired();
        builder.Property(assignment => assignment.ScaleSnapshotId).IsRequired();
        builder.Property(assignment => assignment.TemplateSnapshotId).IsRequired();
        builder.Property(assignment => assignment.ObjectivePlanSnapshotId);
        builder.Property(assignment => assignment.SkillSnapshotId);
        builder.Property(assignment => assignment.Status)
            .HasConversion<string>()
            .HasMaxLength(24)
            .HasDefaultValue(EvaluationAssignmentStatus.NotStarted)
            .IsRequired();
        builder.Property(assignment => assignment.SubmittedAt);
        builder.Property(assignment => assignment.OverallObjectivesRatingOrdinal);
        builder.Property(assignment => assignment.OverallSkillsRatingOrdinal);
        builder.Property(assignment => assignment.DiscussionSummary)
            .HasMaxLength(EvaluationAssignment.DiscussionSummaryMaxLength);
        builder.Property(assignment => assignment.FinalScore).HasPrecision(3, 1);
        builder.Property(assignment => assignment.FinalRatingOrdinal);
        builder.Property(assignment => assignment.FinalizedAt);
        builder.Property(assignment => assignment.AcknowledgedAt);
        builder.Property(assignment => assignment.AcknowledgementComment)
            .HasMaxLength(EvaluationAssignment.AcknowledgementCommentMaxLength);

        builder.HasOne<EvaluationRoundSkillSnapshot>()
            .WithMany()
            .HasForeignKey(assignment => assignment.SkillSnapshotId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(assignment => assignment.ObjectiveRatings)
            .WithOne()
            .HasForeignKey(rating => rating.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(assignment => assignment.SkillRatings)
            .WithOne()
            .HasForeignKey(rating => rating.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(assignment => assignment.QuestionAnswers)
            .WithOne()
            .HasForeignKey(answer => answer.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationAssignment.ObjectiveRatings))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(EvaluationAssignment.SkillRatings))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(EvaluationAssignment.QuestionAnswers))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.HasOne<EvaluationRound>()
            .WithMany()
            .HasForeignKey(assignment => assignment.RoundId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<EvaluationRoundParticipant>()
            .WithMany()
            .HasForeignKey(assignment => assignment.RoundParticipantId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(assignment => new
        {
            assignment.TenantId,
            assignment.RoundId,
            assignment.ParticipantEmployeeId,
            assignment.Kind
        }).IsUnique().HasDatabaseName("UX_EvaluationAssignments_Tenant_Round_Participant_Kind");
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.RoundId, assignment.Status });
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.ParticipantEmployeeId, assignment.Status });
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.AssigneeEmployeeId, assignment.Status });
        builder.Ignore(assignment => assignment.DomainEvents);
    }
}
