using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationRoundProficiencyDraftLevelConfiguration : IEntityTypeConfiguration<EvaluationRoundProficiencyDraftLevel>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundProficiencyDraftLevel> builder)
    {
        builder.ToTable("EvaluationRoundProficiencyDraftLevels");
        builder.HasKey(level => level.Id);
        builder.Property(level => level.TenantId).IsRequired();
        builder.Property(level => level.RoundId).IsRequired();
        builder.Property(level => level.SourceLevelId).IsRequired();
        builder.Property(level => level.Ordinal).IsRequired();
        builder.Property(level => level.Label).HasMaxLength(ProficiencyScaleLevel.LabelMaxLength).IsRequired();
        builder.Property(level => level.Description).HasMaxLength(ProficiencyScaleLevel.DescriptionMaxLength);
        builder.HasIndex(level => new { level.TenantId, level.RoundId, level.Ordinal }).IsUnique();
        builder.Ignore(level => level.Value);
    }
}

public sealed class EvaluationRoundSkillDraftItemConfiguration : IEntityTypeConfiguration<EvaluationRoundSkillDraftItem>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundSkillDraftItem> builder)
    {
        builder.ToTable("EvaluationRoundSkillDraftItems");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.RoundId).IsRequired();
        builder.Property(item => item.SkillId).IsRequired();
        builder.Property(item => item.SkillName).HasMaxLength(Skill.NameMaxLength).IsRequired();
        builder.Property(item => item.CategoryName).HasMaxLength(SkillCategory.NameMaxLength).IsRequired();
        builder.Property(item => item.ExpectedLevelOrdinal).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.RoundId, item.SkillId }).IsUnique();
    }
}

public sealed class EvaluationRoundSkillSnapshotConfiguration : IEntityTypeConfiguration<EvaluationRoundSkillSnapshot>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundSkillSnapshot> builder)
    {
        builder.ToTable("EvaluationRoundSkillSnapshots");
        builder.HasKey(snapshot => snapshot.Id);
        builder.Property(snapshot => snapshot.TenantId).IsRequired();
        builder.Property(snapshot => snapshot.RoundId).IsRequired();
        builder.Property(snapshot => snapshot.SourceExpectationSetId).IsRequired();
        builder.Property(snapshot => snapshot.SetName).HasMaxLength(SkillExpectationSet.NameMaxLength).IsRequired();
        builder.Property(snapshot => snapshot.ProficiencyScaleName).HasMaxLength(ProficiencyScale.NameMaxLength).IsRequired();
        builder.HasMany(snapshot => snapshot.Levels)
            .WithOne()
            .HasForeignKey(level => level.SkillSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(snapshot => snapshot.Items)
            .WithOne()
            .HasForeignKey(item => item.SkillSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationRoundSkillSnapshot.Levels))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(EvaluationRoundSkillSnapshot.Items))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(snapshot => new { snapshot.TenantId, snapshot.RoundId }).IsUnique();
    }
}

public sealed class EvaluationRoundSkillSnapshotLevelConfiguration : IEntityTypeConfiguration<EvaluationRoundSkillSnapshotLevel>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundSkillSnapshotLevel> builder)
    {
        builder.ToTable("EvaluationRoundSkillSnapshotLevels");
        builder.HasKey(level => level.Id);
        builder.Property(level => level.TenantId).IsRequired();
        builder.Property(level => level.SkillSnapshotId).IsRequired();
        builder.Property(level => level.SourceLevelId).IsRequired();
        builder.Property(level => level.Ordinal).IsRequired();
        builder.Property(level => level.Label).HasMaxLength(ProficiencyScaleLevel.LabelMaxLength).IsRequired();
        builder.Property(level => level.Description).HasMaxLength(ProficiencyScaleLevel.DescriptionMaxLength);
        builder.HasIndex(level => new { level.TenantId, level.SkillSnapshotId, level.Ordinal }).IsUnique();
        builder.Ignore(level => level.Value);
    }
}

public sealed class EvaluationRoundSkillSnapshotItemConfiguration : IEntityTypeConfiguration<EvaluationRoundSkillSnapshotItem>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundSkillSnapshotItem> builder)
    {
        builder.ToTable("EvaluationRoundSkillSnapshotItems");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.SkillSnapshotId).IsRequired();
        builder.Property(item => item.SkillId).IsRequired();
        builder.Property(item => item.SkillName).HasMaxLength(Skill.NameMaxLength).IsRequired();
        builder.Property(item => item.CategoryName).HasMaxLength(SkillCategory.NameMaxLength).IsRequired();
        builder.Property(item => item.ExpectedLevelOrdinal).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.SkillSnapshotId, item.SkillId }).IsUnique();
    }
}

public sealed class EvaluationObjectiveRatingConfiguration : IEntityTypeConfiguration<EvaluationObjectiveRating>
{
    public void Configure(EntityTypeBuilder<EvaluationObjectiveRating> builder)
    {
        builder.ToTable("EvaluationObjectiveRatings");
        builder.HasKey(rating => rating.Id);
        builder.Property(rating => rating.TenantId).IsRequired();
        builder.Property(rating => rating.AssignmentId).IsRequired();
        builder.Property(rating => rating.ObjectiveSnapshotId).IsRequired();
        builder.Property(rating => rating.Comment).HasMaxLength(EvaluationObjectiveRating.CommentMaxLength);
        builder.HasIndex(rating => new { rating.TenantId, rating.AssignmentId, rating.ObjectiveSnapshotId }).IsUnique();
        builder.HasIndex(rating => new { rating.TenantId, rating.AssignmentId });
    }
}

public sealed class EvaluationSkillRatingConfiguration : IEntityTypeConfiguration<EvaluationSkillRating>
{
    public void Configure(EntityTypeBuilder<EvaluationSkillRating> builder)
    {
        builder.ToTable("EvaluationSkillRatings");
        builder.HasKey(rating => rating.Id);
        builder.Property(rating => rating.TenantId).IsRequired();
        builder.Property(rating => rating.AssignmentId).IsRequired();
        builder.Property(rating => rating.SkillSnapshotItemId).IsRequired();
        builder.Property(rating => rating.Comment).HasMaxLength(EvaluationSkillRating.CommentMaxLength);
        builder.HasIndex(rating => new { rating.TenantId, rating.AssignmentId, rating.SkillSnapshotItemId }).IsUnique();
        builder.HasIndex(rating => new { rating.TenantId, rating.AssignmentId });
    }
}

public sealed class EvaluationQuestionAnswerConfiguration : IEntityTypeConfiguration<EvaluationQuestionAnswer>
{
    public void Configure(EntityTypeBuilder<EvaluationQuestionAnswer> builder)
    {
        builder.ToTable("EvaluationQuestionAnswers");
        builder.HasKey(answer => answer.Id);
        builder.Property(answer => answer.TenantId).IsRequired();
        builder.Property(answer => answer.AssignmentId).IsRequired();
        builder.Property(answer => answer.QuestionSnapshotId).IsRequired();
        builder.Property(answer => answer.TextAnswer).HasMaxLength(EvaluationQuestionAnswer.TextAnswerMaxLength);
        builder.Property(answer => answer.IsNotApplicable).HasDefaultValue(false).IsRequired();
        builder.Property(answer => answer.NotApplicableReason).HasMaxLength(EvaluationQuestionAnswer.NotApplicableReasonMaxLength);
        builder.HasIndex(answer => new { answer.TenantId, answer.AssignmentId, answer.QuestionSnapshotId }).IsUnique();
        builder.HasIndex(answer => new { answer.TenantId, answer.AssignmentId });
    }
}
