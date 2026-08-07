using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class TenantAdministratorAssignmentConfiguration : IEntityTypeConfiguration<TenantAdministratorAssignment>
{
    public void Configure(EntityTypeBuilder<TenantAdministratorAssignment> builder)
    {
        builder.ToTable("TenantAdministratorAssignments");

        builder.HasKey(assignment => assignment.Id);

        builder.Property(assignment => assignment.GrantedByActorType)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(assignment => assignment.GrantedAt)
            .IsRequired();

        builder.Property(assignment => assignment.RevocationReason)
            .HasMaxLength(256);

        builder.HasIndex(assignment => assignment.TenantId);
        builder.HasIndex(assignment => assignment.UserId);
        builder.HasIndex(assignment => assignment.SourceInvitationId);

        // At most one active authority per membership. Revoked rows accumulate
        // alongside it as first-class history rather than being deleted.
        builder.HasIndex(assignment => assignment.TenantMembershipId)
            .IsUnique()
            .HasFilter("\"RevokedAt\" IS NULL")
            .HasDatabaseName("IX_TenantAdministratorAssignments_MembershipActiveUnique");

        // Supports the usable-administrator count, which is read under the tenant
        // continuity lock on every authority-affecting command.
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.RevokedAt })
            .HasDatabaseName("IX_TenantAdministratorAssignments_TenantId_RevokedAt");

        builder.HasOne(assignment => assignment.User)
            .WithMany()
            .HasForeignKey(assignment => assignment.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Same tenant-safe composite foreign key the access assignments use: an
        // assignment whose account or tenant disagrees with its membership is
        // unstorable, so cross-tenant authority is impossible by construction.
        builder.HasOne(assignment => assignment.TenantMembership)
            .WithMany(membership => membership.AdministratorAssignments)
            .HasForeignKey(assignment => new
            {
                assignment.TenantMembershipId,
                assignment.UserId,
                assignment.TenantId,
            })
            .HasPrincipalKey(membership => new
            {
                membership.Id,
                membership.UserId,
                membership.TenantId,
            })
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
