using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> builder)
    {
        builder.ToTable("Positions");
        builder.HasKey(position => position.Id);
        builder.Property(position => position.Version).IsRowVersion();
        builder.Property(position => position.TenantId).IsRequired();
        builder.Property(position => position.Code).HasMaxLength(64).IsRequired();
        builder.Property(position => position.Title).HasMaxLength(150).IsRequired();
        builder.Property(position => position.IsActive).IsRequired();
        builder.HasIndex(position => new { position.TenantId, position.Code }).IsUnique();
        builder.HasIndex(position => new { position.TenantId, position.OrgUnitId });
        builder.Ignore(position => position.DomainEvents);
    }
}
