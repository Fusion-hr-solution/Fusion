using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Configurations;

public sealed class OrgUnitCodeReservationConfiguration : IEntityTypeConfiguration<OrgUnitCodeReservation>
{
    public void Configure(EntityTypeBuilder<OrgUnitCodeReservation> builder)
    {
        builder.ToTable("OrgUnitCodeReservations");
        builder.HasKey(reservation => reservation.Id);
        builder.Property(reservation => reservation.TenantId).IsRequired();
        builder.Property(reservation => reservation.NormalizedCode).HasMaxLength(50).IsRequired();
        builder.Property(reservation => reservation.CreatedBy).HasMaxLength(256);
        builder.HasIndex(reservation => new { reservation.TenantId, reservation.NormalizedCode })
            .IsUnique()
            .HasDatabaseName("UX_OrgUnitCodeReservations_TenantId_NormalizedCode");
        builder.HasOne(reservation => reservation.OrgUnit)
            .WithMany(unit => unit.CodeReservations)
            .HasForeignKey(reservation => reservation.OrgUnitId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
