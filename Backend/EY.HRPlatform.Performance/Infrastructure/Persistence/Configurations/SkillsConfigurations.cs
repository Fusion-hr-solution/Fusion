using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class SkillCategoryConfiguration : IEntityTypeConfiguration<SkillCategory>
{
    public void Configure(EntityTypeBuilder<SkillCategory> builder)
    {
        builder.ToTable("SkillCategories");
        builder.HasKey(category => category.Id);
        builder.Property(category => category.Version).IsRowVersion();
        builder.Property(category => category.TenantId).IsRequired();
        builder.Property(category => category.Name).HasMaxLength(SkillCategory.NameMaxLength).IsRequired();
        builder.Property(category => category.NormalizedName).HasMaxLength(SkillCategory.NameMaxLength).IsRequired();
        builder.Property(category => category.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(SkillLifecycleStatus.Active)
            .IsRequired();
        builder.Property(category => category.CreatedBy).HasMaxLength(256);
        builder.Property(category => category.UpdatedBy).HasMaxLength(256);

        builder.HasIndex(category => new { category.TenantId, category.Status });
        builder.HasIndex(category => new { category.TenantId, category.NormalizedName })
            .IsUnique()
            .HasFilter("\"Status\" <> 'Archived'")
            .HasDatabaseName("UX_SkillCategories_Tenant_ActiveNormalizedName");
        builder.Ignore(category => category.DomainEvents);
    }
}

public sealed class SkillConfiguration : IEntityTypeConfiguration<Skill>
{
    public void Configure(EntityTypeBuilder<Skill> builder)
    {
        builder.ToTable("Skills");
        builder.HasKey(skill => skill.Id);
        builder.Property(skill => skill.Version).IsRowVersion();
        builder.Property(skill => skill.TenantId).IsRequired();
        builder.Property(skill => skill.Name).HasMaxLength(Skill.NameMaxLength).IsRequired();
        builder.Property(skill => skill.NormalizedName).HasMaxLength(Skill.NameMaxLength).IsRequired();
        builder.Property(skill => skill.Description).HasMaxLength(Skill.DescriptionMaxLength);
        builder.Property(skill => skill.SkillCategoryId).IsRequired();
        builder.Property(skill => skill.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(SkillLifecycleStatus.Active)
            .IsRequired();
        builder.Property(skill => skill.IsInUse).HasDefaultValue(false).IsRequired();
        builder.Property(skill => skill.CreatedBy).HasMaxLength(256);
        builder.Property(skill => skill.UpdatedBy).HasMaxLength(256);

        builder.HasOne<SkillCategory>()
            .WithMany()
            .HasForeignKey(skill => skill.SkillCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(skill => new { skill.TenantId, skill.Status });
        builder.HasIndex(skill => new { skill.TenantId, skill.SkillCategoryId });
        builder.HasIndex(skill => new { skill.TenantId, skill.NormalizedName })
            .IsUnique()
            .HasFilter("\"Status\" <> 'Archived'")
            .HasDatabaseName("UX_Skills_Tenant_ActiveNormalizedName");
        builder.Ignore(skill => skill.DomainEvents);
    }
}

public sealed class ProficiencyScaleConfiguration : IEntityTypeConfiguration<ProficiencyScale>
{
    public void Configure(EntityTypeBuilder<ProficiencyScale> builder)
    {
        builder.ToTable("ProficiencyScales");
        builder.HasKey(scale => scale.Id);
        builder.Property(scale => scale.Version).IsRowVersion();
        builder.Property(scale => scale.TenantId).IsRequired();
        builder.Property(scale => scale.Name).HasMaxLength(ProficiencyScale.NameMaxLength).IsRequired();
        builder.Property(scale => scale.NormalizedName).HasMaxLength(ProficiencyScale.NameMaxLength).IsRequired();
        builder.Property(scale => scale.Description).HasMaxLength(ProficiencyScale.DescriptionMaxLength);
        builder.Property(scale => scale.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EvaluationConfigStatus.Draft)
            .IsRequired();
        builder.Property(scale => scale.IsInUse).HasDefaultValue(false).IsRequired();
        builder.Property(scale => scale.CreatedBy).HasMaxLength(256);
        builder.Property(scale => scale.UpdatedBy).HasMaxLength(256);

        builder.HasMany(scale => scale.Levels)
            .WithOne()
            .HasForeignKey(level => level.ProficiencyScaleId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(ProficiencyScale.Levels))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(scale => new { scale.TenantId, scale.Status });
        builder.HasIndex(scale => new { scale.TenantId, scale.NormalizedName })
            .IsUnique()
            .HasFilter("\"Status\" <> 'Archived'")
            .HasDatabaseName("UX_ProficiencyScales_Tenant_ActiveNormalizedName");
        builder.Ignore(scale => scale.DomainEvents);
    }
}

public sealed class ProficiencyScaleLevelConfiguration : IEntityTypeConfiguration<ProficiencyScaleLevel>
{
    public void Configure(EntityTypeBuilder<ProficiencyScaleLevel> builder)
    {
        builder.ToTable("ProficiencyScaleLevels");
        builder.HasKey(level => level.Id);
        builder.Property(level => level.TenantId).IsRequired();
        builder.Property(level => level.ProficiencyScaleId).IsRequired();
        builder.Property(level => level.Ordinal).IsRequired();
        builder.Property(level => level.Label).HasMaxLength(ProficiencyScaleLevel.LabelMaxLength).IsRequired();
        builder.Property(level => level.Description).HasMaxLength(ProficiencyScaleLevel.DescriptionMaxLength);
        builder.HasIndex(level => new { level.TenantId, level.ProficiencyScaleId, level.Ordinal }).IsUnique();
        builder.Ignore(level => level.Value);
    }
}

public sealed class SkillExpectationSetConfiguration : IEntityTypeConfiguration<SkillExpectationSet>
{
    public void Configure(EntityTypeBuilder<SkillExpectationSet> builder)
    {
        builder.ToTable("SkillExpectationSets");
        builder.HasKey(set => set.Id);
        builder.Property(set => set.Version).IsRowVersion();
        builder.Property(set => set.TenantId).IsRequired();
        builder.Property(set => set.Name).HasMaxLength(SkillExpectationSet.NameMaxLength).IsRequired();
        builder.Property(set => set.NormalizedName).HasMaxLength(SkillExpectationSet.NameMaxLength).IsRequired();
        builder.Property(set => set.Description).HasMaxLength(SkillExpectationSet.DescriptionMaxLength);
        builder.Property(set => set.ProficiencyScaleId).IsRequired();
        builder.Property(set => set.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EvaluationConfigStatus.Draft)
            .IsRequired();
        builder.Property(set => set.IsInUse).HasDefaultValue(false).IsRequired();
        builder.Property(set => set.CreatedBy).HasMaxLength(256);
        builder.Property(set => set.UpdatedBy).HasMaxLength(256);

        builder.HasOne<ProficiencyScale>()
            .WithMany()
            .HasForeignKey(set => set.ProficiencyScaleId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(set => set.Items)
            .WithOne()
            .HasForeignKey(item => item.ExpectationSetId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(SkillExpectationSet.Items))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(set => new { set.TenantId, set.Status });
        builder.HasIndex(set => new { set.TenantId, set.ProficiencyScaleId });
        builder.HasIndex(set => new { set.TenantId, set.NormalizedName })
            .IsUnique()
            .HasFilter("\"Status\" <> 'Archived'")
            .HasDatabaseName("UX_SkillExpectationSets_Tenant_ActiveNormalizedName");
        builder.Ignore(set => set.DomainEvents);
    }
}

public sealed class SkillExpectationItemConfiguration : IEntityTypeConfiguration<SkillExpectationItem>
{
    public void Configure(EntityTypeBuilder<SkillExpectationItem> builder)
    {
        builder.ToTable("SkillExpectationItems");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.TenantId).IsRequired();
        builder.Property(item => item.ExpectationSetId).IsRequired();
        builder.Property(item => item.SkillId).IsRequired();
        builder.Property(item => item.ExpectedLevelOrdinal).IsRequired();
        builder.HasOne<Skill>()
            .WithMany()
            .HasForeignKey(item => item.SkillId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(item => new { item.TenantId, item.ExpectationSetId, item.SkillId }).IsUnique();
    }
}
