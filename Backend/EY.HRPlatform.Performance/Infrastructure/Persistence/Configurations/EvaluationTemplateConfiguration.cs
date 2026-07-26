using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationTemplateConfiguration : IEntityTypeConfiguration<EvaluationTemplate>
{
    public void Configure(EntityTypeBuilder<EvaluationTemplate> builder)
    {
        builder.ToTable("EvaluationTemplates");
        builder.HasKey(template => template.Id);
        builder.Property(template => template.Version).IsRowVersion();
        builder.Property(template => template.TenantId).IsRequired();
        builder.Property(template => template.Name).HasMaxLength(EvaluationTemplate.NameMaxLength).IsRequired();
        builder.Property(template => template.Purpose).HasMaxLength(EvaluationTemplate.PurposeMaxLength);
        builder.Property(template => template.ParticipantInstructions).HasMaxLength(EvaluationTemplate.InstructionsMaxLength);
        builder.Property(template => template.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EvaluationConfigStatus.Draft)
            .IsRequired();
        builder.Property(template => template.IsInUse).HasDefaultValue(false).IsRequired();

        builder.HasMany(template => template.Sections)
            .WithOne()
            .HasForeignKey(section => section.TemplateId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(template => template.Questions)
            .WithOne()
            .HasForeignKey(question => question.TemplateId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(EvaluationTemplate.Sections))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(EvaluationTemplate.Questions))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(template => new { template.TenantId, template.Status });
        builder.HasIndex(template => new { template.TenantId, template.Name, template.Status });
        builder.HasIndex(template => new { template.TenantId, template.Name })
            .IsUnique()
            .HasFilter("\"Status\" = 'Active'")
            .HasDatabaseName("UX_EvaluationTemplates_Tenant_ActiveName");
        builder.Ignore(template => template.DomainEvents);
    }
}

public sealed class EvaluationTemplateSectionConfiguration : IEntityTypeConfiguration<EvaluationTemplateSection>
{
    public void Configure(EntityTypeBuilder<EvaluationTemplateSection> builder)
    {
        builder.ToTable("EvaluationTemplateSections");
        builder.HasKey(section => section.Id);
        builder.Property(section => section.TenantId).IsRequired();
        builder.Property(section => section.TemplateId).IsRequired();
        builder.Property(section => section.Type).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(section => section.Ordinal).IsRequired();
        builder.Property(section => section.Title).HasMaxLength(EvaluationTemplateSection.TitleMaxLength).IsRequired();
        builder.Property(section => section.Guidance).HasMaxLength(EvaluationTemplateSection.GuidanceMaxLength);
        builder.HasIndex(section => new { section.TenantId, section.TemplateId, section.Ordinal }).IsUnique();
        builder.HasIndex(section => new { section.TenantId, section.TemplateId, section.Type }).IsUnique();
    }
}

public sealed class EvaluationTemplateQuestionConfiguration : IEntityTypeConfiguration<EvaluationTemplateQuestion>
{
    public void Configure(EntityTypeBuilder<EvaluationTemplateQuestion> builder)
    {
        builder.ToTable("EvaluationTemplateQuestions");
        builder.HasKey(question => question.Id);
        builder.Property(question => question.TenantId).IsRequired();
        builder.Property(question => question.TemplateId).IsRequired();
        builder.Property(question => question.SectionId).IsRequired();
        builder.Property(question => question.Ordinal).IsRequired();
        builder.Property(question => question.Prompt).HasMaxLength(EvaluationTemplateQuestion.PromptMaxLength).IsRequired();
        builder.Property(question => question.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(question => question.TargetRater).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(question => question.IsRequired).IsRequired();
        builder.Property(question => question.AllowNotApplicable).IsRequired();
        builder.HasOne<EvaluationTemplateSection>()
            .WithMany()
            .HasForeignKey(question => question.SectionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(question => new { question.TenantId, question.TemplateId, question.SectionId, question.Ordinal }).IsUnique();
    }
}
