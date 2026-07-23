using EY.HRPlatform.Performance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationRoundScaleSnapshotConfiguration : IEntityTypeConfiguration<EvaluationRoundScaleSnapshot>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundScaleSnapshot> builder)
    {
        builder.ToTable("EvaluationRoundScaleSnapshots");
        builder.HasKey(snapshot => snapshot.Id);
        builder.Property(snapshot => snapshot.TenantId).IsRequired();
        builder.Property(snapshot => snapshot.RoundId).IsRequired();
        builder.Property(snapshot => snapshot.SourceRatingScaleId).IsRequired();
        builder.Property(snapshot => snapshot.Name).HasMaxLength(EvaluationRatingScale.NameMaxLength).IsRequired();
        builder.Property(snapshot => snapshot.Description).HasMaxLength(EvaluationRatingScale.DescriptionMaxLength);
        builder.HasMany(snapshot => snapshot.Levels)
            .WithOne()
            .HasForeignKey(level => level.ScaleSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationRoundScaleSnapshot.Levels))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(snapshot => new { snapshot.TenantId, snapshot.RoundId }).IsUnique();
    }
}

public sealed class EvaluationRoundScaleSnapshotLevelConfiguration : IEntityTypeConfiguration<EvaluationRoundScaleSnapshotLevel>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundScaleSnapshotLevel> builder)
    {
        builder.ToTable("EvaluationRoundScaleSnapshotLevels");
        builder.HasKey(level => level.Id);
        builder.Property(level => level.TenantId).IsRequired();
        builder.Property(level => level.ScaleSnapshotId).IsRequired();
        builder.Property(level => level.SourceLevelId).IsRequired();
        builder.Property(level => level.Ordinal).IsRequired();
        builder.Property(level => level.Label).HasMaxLength(EvaluationRatingScaleLevel.LabelMaxLength).IsRequired();
        builder.Property(level => level.Description).HasMaxLength(EvaluationRatingScaleLevel.DescriptionMaxLength);
        builder.Property(level => level.BehavioralGuidance).HasMaxLength(EvaluationRatingScaleLevel.BehavioralGuidanceMaxLength);
        builder.HasIndex(level => new { level.TenantId, level.ScaleSnapshotId, level.Ordinal }).IsUnique();
        builder.Ignore(level => level.Value);
    }
}

public sealed class EvaluationRoundTemplateSnapshotConfiguration : IEntityTypeConfiguration<EvaluationRoundTemplateSnapshot>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundTemplateSnapshot> builder)
    {
        builder.ToTable("EvaluationRoundTemplateSnapshots");
        builder.HasKey(snapshot => snapshot.Id);
        builder.Property(snapshot => snapshot.TenantId).IsRequired();
        builder.Property(snapshot => snapshot.RoundId).IsRequired();
        builder.Property(snapshot => snapshot.SourceTemplateId).IsRequired();
        builder.Property(snapshot => snapshot.Name).HasMaxLength(EvaluationTemplate.NameMaxLength).IsRequired();
        builder.Property(snapshot => snapshot.Purpose).HasMaxLength(EvaluationTemplate.PurposeMaxLength);
        builder.Property(snapshot => snapshot.ParticipantInstructions).HasMaxLength(EvaluationTemplate.InstructionsMaxLength);
        builder.HasMany(snapshot => snapshot.Sections)
            .WithOne()
            .HasForeignKey(section => section.TemplateSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(snapshot => snapshot.Questions)
            .WithOne()
            .HasForeignKey(question => question.TemplateSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationRoundTemplateSnapshot.Sections))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(EvaluationRoundTemplateSnapshot.Questions))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(snapshot => new { snapshot.TenantId, snapshot.RoundId }).IsUnique();
    }
}

public sealed class EvaluationRoundTemplateSnapshotSectionConfiguration : IEntityTypeConfiguration<EvaluationRoundTemplateSnapshotSection>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundTemplateSnapshotSection> builder)
    {
        builder.ToTable("EvaluationRoundTemplateSnapshotSections");
        builder.HasKey(section => section.Id);
        builder.Property(section => section.TenantId).IsRequired();
        builder.Property(section => section.TemplateSnapshotId).IsRequired();
        builder.Property(section => section.SourceSectionId).IsRequired();
        builder.Property(section => section.Type).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(section => section.Ordinal).IsRequired();
        builder.Property(section => section.Title).HasMaxLength(EvaluationTemplateSection.TitleMaxLength).IsRequired();
        builder.Property(section => section.Guidance).HasMaxLength(EvaluationTemplateSection.GuidanceMaxLength);
        builder.HasIndex(section => new { section.TenantId, section.TemplateSnapshotId, section.Ordinal }).IsUnique();
    }
}

public sealed class EvaluationRoundTemplateSnapshotQuestionConfiguration : IEntityTypeConfiguration<EvaluationRoundTemplateSnapshotQuestion>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundTemplateSnapshotQuestion> builder)
    {
        builder.ToTable("EvaluationRoundTemplateSnapshotQuestions");
        builder.HasKey(question => question.Id);
        builder.Property(question => question.TenantId).IsRequired();
        builder.Property(question => question.TemplateSnapshotId).IsRequired();
        builder.Property(question => question.SectionSnapshotId).IsRequired();
        builder.Property(question => question.SourceQuestionId).IsRequired();
        builder.Property(question => question.Ordinal).IsRequired();
        builder.Property(question => question.Prompt).HasMaxLength(EvaluationTemplateQuestion.PromptMaxLength).IsRequired();
        builder.Property(question => question.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(question => question.TargetRater).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasOne<EvaluationRoundTemplateSnapshotSection>()
            .WithMany()
            .HasForeignKey(question => question.SectionSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(question => new
        {
            question.TenantId,
            question.TemplateSnapshotId,
            question.SectionSnapshotId,
            question.Ordinal
        }).IsUnique();
    }
}

public sealed class EvaluationRoundPolicySnapshotConfiguration : IEntityTypeConfiguration<EvaluationRoundPolicySnapshot>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundPolicySnapshot> builder)
    {
        builder.ToTable("EvaluationRoundPolicySnapshots");
        builder.HasKey(snapshot => snapshot.Id);
        builder.Property(snapshot => snapshot.TenantId).IsRequired();
        builder.Property(snapshot => snapshot.RoundId).IsRequired();
        builder.Property(snapshot => snapshot.AssessmentModel).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(snapshot => snapshot.VisibilityModel).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.HasIndex(snapshot => new { snapshot.TenantId, snapshot.RoundId }).IsUnique();
    }
}

public sealed class EvaluationObjectivePlanSnapshotConfiguration : IEntityTypeConfiguration<EvaluationObjectivePlanSnapshot>
{
    public void Configure(EntityTypeBuilder<EvaluationObjectivePlanSnapshot> builder)
    {
        builder.ToTable("EvaluationObjectivePlanSnapshots");
        builder.HasKey(snapshot => snapshot.Id);
        builder.Property(snapshot => snapshot.TenantId).IsRequired();
        builder.Property(snapshot => snapshot.RoundId).IsRequired();
        builder.Property(snapshot => snapshot.ParticipantEmployeeId).IsRequired();
        builder.Property(snapshot => snapshot.SourceObjectivePlanId).IsRequired();
        builder.HasMany(snapshot => snapshot.Objectives)
            .WithOne()
            .HasForeignKey(objective => objective.ObjectivePlanSnapshotId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationObjectivePlanSnapshot.Objectives))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(snapshot => new { snapshot.TenantId, snapshot.RoundId, snapshot.ParticipantEmployeeId }).IsUnique();
        builder.HasIndex(snapshot => new { snapshot.TenantId, snapshot.SourceObjectivePlanId });
    }
}

public sealed class EvaluationObjectiveSnapshotConfiguration : IEntityTypeConfiguration<EvaluationObjectiveSnapshot>
{
    public void Configure(EntityTypeBuilder<EvaluationObjectiveSnapshot> builder)
    {
        builder.ToTable("EvaluationObjectiveSnapshots");
        builder.HasKey(objective => objective.Id);
        builder.Property(objective => objective.TenantId).IsRequired();
        builder.Property(objective => objective.ObjectivePlanSnapshotId).IsRequired();
        builder.Property(objective => objective.SourceObjectiveId).IsRequired();
        builder.Property(objective => objective.Title).HasMaxLength(EmployeeObjective.TitleMaxLength).IsRequired();
        builder.Property(objective => objective.Description).HasMaxLength(EmployeeObjective.DescriptionMaxLength);
        builder.Property(objective => objective.AlignmentType).HasConversion<string>().HasMaxLength(32);
        builder.Property(objective => objective.AlignmentTitle).HasMaxLength(EmployeeObjective.AlignmentTitleMaxLength);
        builder.Property(objective => objective.MeasurementMethod).HasMaxLength(EmployeeObjective.MeasurementMethodMaxLength);
        builder.Property(objective => objective.MeasurementIndicator).HasMaxLength(EmployeeObjective.MeasurementIndicatorMaxLength);
        builder.Property(objective => objective.TargetValue).HasMaxLength(EmployeeObjective.TargetValueMaxLength);
        builder.Property(objective => objective.TargetUnit).HasMaxLength(EmployeeObjective.TargetUnitMaxLength);
        builder.Property(objective => objective.SuccessCriteria).HasMaxLength(EmployeeObjective.SuccessCriteriaMaxLength);
        builder.HasIndex(objective => new { objective.TenantId, objective.ObjectivePlanSnapshotId, objective.SourceObjectiveId }).IsUnique();
    }
}
