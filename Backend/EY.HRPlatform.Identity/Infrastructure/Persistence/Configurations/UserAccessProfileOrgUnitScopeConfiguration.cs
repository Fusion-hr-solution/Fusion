using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public sealed class UserAccessProfileOrgUnitScopeConfiguration : IEntityTypeConfiguration<UserAccessProfileOrgUnitScope>
{
    public void Configure(EntityTypeBuilder<UserAccessProfileOrgUnitScope> builder)
    {
        builder.ToTable("UserAccessProfileOrgUnitScopes");

        builder.HasKey(scope => new { scope.UserId, scope.AccessProfileId, scope.OrgUnitId });
        builder.HasIndex(scope => scope.TenantId);
        builder.HasIndex(scope => new { scope.TenantId, scope.OrgUnitId });

        builder.HasOne<UserAccessProfile>()
            .WithMany()
            .HasForeignKey(scope => new { scope.UserId, scope.AccessProfileId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}
