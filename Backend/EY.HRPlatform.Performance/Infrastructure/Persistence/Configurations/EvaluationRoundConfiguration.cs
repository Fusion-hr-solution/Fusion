using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationRoundConfiguration : IEntityTypeConfiguration<EvaluationRound>
{
    public void Configure(EntityTypeBuilder<EvaluationRound> builder)
    {
        builder.ToTable("EvaluationRounds");
        builder.HasKey(round => round.Id);
        builder.Property(round => round.Version).IsRowVersion();
        builder.Property(round => round.TenantId).IsRequired();
        builder.Property(round => round.PerformanceCycleId).IsRequired();
        builder.Property(round => round.Name).HasMaxLength(EvaluationRound.NameMaxLength).IsRequired();
        builder.Property(round => round.Purpose).HasMaxLength(EvaluationRound.PurposeMaxLength);
        builder.Property(round => round.Type).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(round => round.AssessmentModel).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(round => round.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EvaluationRoundStatus.Draft)
            .IsRequired();
        builder.Property(round => round.SourceRatingScaleId);
        builder.Property(round => round.DraftRatingScaleName).HasMaxLength(EvaluationRatingScale.NameMaxLength);
        builder.Property(round => round.DraftRatingScaleDescription).HasMaxLength(EvaluationRatingScale.DescriptionMaxLength);
        builder.Property(round => round.SourceTemplateId);
        builder.Property(round => round.DraftTemplateName).HasMaxLength(EvaluationTemplate.NameMaxLength);
        builder.Property(round => round.DraftTemplatePurpose).HasMaxLength(EvaluationTemplate.PurposeMaxLength);
        builder.Property(round => round.DraftTemplateInstructions).HasMaxLength(EvaluationTemplate.InstructionsMaxLength);

        builder.HasOne<PerformanceCycle>()
            .WithMany()
            .HasForeignKey(round => round.PerformanceCycleId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(round => round.ScaleSnapshot)
            .WithOne()
            .HasForeignKey<EvaluationRoundScaleSnapshot>(snapshot => snapshot.RoundId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(round => round.TemplateSnapshot)
            .WithOne()
            .HasForeignKey<EvaluationRoundTemplateSnapshot>(snapshot => snapshot.RoundId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(round => round.PolicySnapshot)
            .WithOne()
            .HasForeignKey<EvaluationRoundPolicySnapshot>(snapshot => snapshot.RoundId)
            .OnDelete(DeleteBehavior.Cascade);

        ConfigureCollection(builder, round => round.DraftScaleLevels, level => level.RoundId);
        ConfigureCollection(builder, round => round.DraftTemplateSections, section => section.RoundId);
        ConfigureCollection(builder, round => round.DraftTemplateQuestions, question => question.RoundId);
        ConfigureCollection(builder, round => round.Exclusions, exclusion => exclusion.RoundId);
        ConfigureCollection(builder, round => round.ReviewerCorrections, correction => correction.RoundId);
        ConfigureCollection(builder, round => round.Participants, participant => participant.RoundId);
        ConfigureCollection(builder, round => round.ObjectivePlanSnapshots, snapshot => snapshot.RoundId);
        ConfigureCollection(builder, round => round.DeadlineExtensions, extension => extension.RoundId);

        foreach (var navigation in new[]
                 {
                     nameof(EvaluationRound.DraftScaleLevels),
                     nameof(EvaluationRound.DraftTemplateSections),
                     nameof(EvaluationRound.DraftTemplateQuestions),
                     nameof(EvaluationRound.Exclusions),
                     nameof(EvaluationRound.ReviewerCorrections),
                     nameof(EvaluationRound.Participants),
                     nameof(EvaluationRound.ObjectivePlanSnapshots),
                     nameof(EvaluationRound.DeadlineExtensions)
                 })
        {
            builder.Metadata.FindNavigation(navigation)!.SetPropertyAccessMode(PropertyAccessMode.Field);
        }

        builder.HasIndex(round => new { round.TenantId, round.PerformanceCycleId, round.Status });
        builder.HasIndex(round => new { round.TenantId, round.Status });
        builder.HasIndex(round => new { round.TenantId, round.SourceRatingScaleId });
        builder.HasIndex(round => new { round.TenantId, round.SourceTemplateId });
        builder.Ignore(round => round.IncludesObjectives);
        builder.Ignore(round => round.DomainEvents);
    }

    private static void ConfigureCollection<TChild>(
        EntityTypeBuilder<EvaluationRound> builder,
        System.Linq.Expressions.Expression<Func<EvaluationRound, IEnumerable<TChild>?>> navigation,
        System.Linq.Expressions.Expression<Func<TChild, object?>> foreignKey)
        where TChild : class
    {
        builder.HasMany(navigation)
            .WithOne()
            .HasForeignKey(foreignKey)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class EvaluationRoundScaleDraftLevelConfiguration : IEntityTypeConfiguration<EvaluationRoundScaleDraftLevel>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundScaleDraftLevel> builder)
    {
        builder.ToTable("EvaluationRoundScaleDraftLevels");
        builder.HasKey(level => level.Id);
        builder.Property(level => level.TenantId).IsRequired();
        builder.Property(level => level.RoundId).IsRequired();
        builder.Property(level => level.SourceLevelId).IsRequired();
        builder.Property(level => level.Ordinal).IsRequired();
        builder.Property(level => level.Label).HasMaxLength(EvaluationRatingScaleLevel.LabelMaxLength).IsRequired();
        builder.Property(level => level.Description).HasMaxLength(EvaluationRatingScaleLevel.DescriptionMaxLength);
        builder.Property(level => level.BehavioralGuidance).HasMaxLength(EvaluationRatingScaleLevel.BehavioralGuidanceMaxLength);
        builder.HasIndex(level => new { level.TenantId, level.RoundId, level.Ordinal }).IsUnique();
        builder.Ignore(level => level.Value);
    }
}

public sealed class EvaluationRoundTemplateDraftSectionConfiguration : IEntityTypeConfiguration<EvaluationRoundTemplateDraftSection>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundTemplateDraftSection> builder)
    {
        builder.ToTable("EvaluationRoundTemplateDraftSections");
        builder.HasKey(section => section.Id);
        builder.Property(section => section.TenantId).IsRequired();
        builder.Property(section => section.RoundId).IsRequired();
        builder.Property(section => section.SourceSectionId).IsRequired();
        builder.Property(section => section.Type).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(section => section.Ordinal).IsRequired();
        builder.Property(section => section.Title).HasMaxLength(EvaluationTemplateSection.TitleMaxLength).IsRequired();
        builder.Property(section => section.Guidance).HasMaxLength(EvaluationTemplateSection.GuidanceMaxLength);
        builder.HasIndex(section => new { section.TenantId, section.RoundId, section.Ordinal }).IsUnique();
    }
}

public sealed class EvaluationRoundTemplateDraftQuestionConfiguration : IEntityTypeConfiguration<EvaluationRoundTemplateDraftQuestion>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundTemplateDraftQuestion> builder)
    {
        builder.ToTable("EvaluationRoundTemplateDraftQuestions");
        builder.HasKey(question => question.Id);
        builder.Property(question => question.TenantId).IsRequired();
        builder.Property(question => question.RoundId).IsRequired();
        builder.Property(question => question.DraftSectionId).IsRequired();
        builder.Property(question => question.SourceQuestionId).IsRequired();
        builder.Property(question => question.Ordinal).IsRequired();
        builder.Property(question => question.Prompt).HasMaxLength(EvaluationTemplateQuestion.PromptMaxLength).IsRequired();
        builder.Property(question => question.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(question => question.TargetRater).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasOne<EvaluationRoundTemplateDraftSection>()
            .WithMany()
            .HasForeignKey(question => question.DraftSectionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(question => new { question.TenantId, question.RoundId, question.DraftSectionId, question.Ordinal }).IsUnique();
    }
}

public sealed class EvaluationRoundExclusionConfiguration : IEntityTypeConfiguration<EvaluationRoundExclusion>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundExclusion> builder)
    {
        builder.ToTable("EvaluationRoundExclusions");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.RoundId).IsRequired();
        builder.Property(item => item.ParticipantEmployeeId).IsRequired();
        builder.Property(item => item.ParticipantName).HasMaxLength(256).IsRequired();
        builder.Property(item => item.Reason).HasMaxLength(EvaluationRoundExclusion.ReasonMaxLength).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.RoundId, item.ParticipantEmployeeId }).IsUnique();
    }
}

public sealed class EvaluationRoundReviewerCorrectionConfiguration : IEntityTypeConfiguration<EvaluationRoundReviewerCorrection>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundReviewerCorrection> builder)
    {
        builder.ToTable("EvaluationRoundReviewerCorrections");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.RoundId).IsRequired();
        builder.Property(item => item.ParticipantEmployeeId).IsRequired();
        builder.Property(item => item.ReviewerEmployeeId).IsRequired();
        builder.Property(item => item.ReviewerName).HasMaxLength(256).IsRequired();
        builder.Property(item => item.Reason).HasMaxLength(EvaluationRoundReviewerCorrection.ReasonMaxLength).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.RoundId, item.ParticipantEmployeeId }).IsUnique();
        builder.HasIndex(item => new { item.TenantId, item.ReviewerEmployeeId });
    }
}

public sealed class EvaluationRoundParticipantConfiguration : IEntityTypeConfiguration<EvaluationRoundParticipant>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundParticipant> builder)
    {
        builder.ToTable("EvaluationRoundParticipants");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.RoundId).IsRequired();
        builder.Property(item => item.CampaignParticipantId).IsRequired();
        builder.Property(item => item.EmployeeId).IsRequired();
        builder.Property(item => item.EmployeeKey).HasMaxLength(100);
        builder.Property(item => item.FullName).HasMaxLength(256).IsRequired();
        builder.Property(item => item.Email).HasMaxLength(320);
        builder.Property(item => item.OrgUnitName).HasMaxLength(256);
        builder.Property(item => item.JobTitle).HasMaxLength(256);
        builder.Property(item => item.ReviewerEmployeeId).IsRequired();
        builder.Property(item => item.ReviewerName).HasMaxLength(256).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.RoundId, item.EmployeeId }).IsUnique();
        builder.HasIndex(item => new { item.TenantId, item.RoundId, item.ReviewerEmployeeId });
        builder.HasIndex(item => new { item.TenantId, item.EmployeeId });
    }
}

public sealed class EvaluationRoundDeadlineExtensionConfiguration : IEntityTypeConfiguration<EvaluationRoundDeadlineExtension>
{
    public void Configure(EntityTypeBuilder<EvaluationRoundDeadlineExtension> builder)
    {
        builder.ToTable("EvaluationRoundDeadlineExtensions");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.RoundId).IsRequired();
        builder.Property(item => item.DeadlineKind).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(item => item.Reason).HasMaxLength(EvaluationRoundDeadlineExtension.ReasonMaxLength).IsRequired();
        builder.Property(item => item.ActorName).HasMaxLength(256).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.RoundId, item.OccurredAt });
    }
}
