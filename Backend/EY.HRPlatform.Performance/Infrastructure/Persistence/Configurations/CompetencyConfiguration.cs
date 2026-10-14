using EY.HRPlatform.Performance.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CompetencyConfiguration : IEntityTypeConfiguration<Competency>
{
    public void Configure(EntityTypeBuilder<Competency> builder)
    {
        builder.ToTable("Competencies");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Version).IsRowVersion();
        builder.Property(item => item.Name).HasMaxLength(160).IsRequired();
        builder.Property(item => item.NameKey).HasMaxLength(160).IsRequired();
        builder.Property(item => item.Description).HasMaxLength(2000).IsRequired();
        builder.Property(item => item.BehaviorsJson).HasColumnName("Behaviors").HasColumnType("jsonb").IsRequired();
        builder.Ignore(item => item.Behaviors);
        builder.Property(item => item.State).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(item => new { item.TenantId, item.NameKey }).IsUnique().HasFilter("\"State\" = 'Active'");
        builder.HasIndex(item => item.TenantId);
    }
}
