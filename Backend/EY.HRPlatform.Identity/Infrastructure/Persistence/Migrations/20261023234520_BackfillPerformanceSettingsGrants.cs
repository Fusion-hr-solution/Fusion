using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Gives every custom profile that holds <c>performance.cycle.manage @Tenant</c> the new
    /// <c>performance.settings.view|manage @Tenant</c> pair, once, so nobody loses settings access when
    /// settings move off cycle administration (B-071 D5). System profiles get the pair from the template
    /// sync at startup. Running once as a migration keeps a later removal removed.
    /// </summary>
    public partial class BackfillPerformanceSettingsGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO identity."AccessProfileGrants" ("TenantId", "AccessProfileId", "PermissionKey", "Scope")
                SELECT profile."TenantId", profile."Id", setting.key, 'Tenant'
                  FROM identity."AccessProfiles" AS profile
                  JOIN identity."AccessProfileGrants" AS cycle
                    ON cycle."AccessProfileId" = profile."Id"
                   AND cycle."TenantId" = profile."TenantId"
                   AND cycle."PermissionKey" = 'performance.cycle.manage'
                   AND cycle."Scope" = 'Tenant'
                 CROSS JOIN (VALUES ('performance.settings.view'), ('performance.settings.manage')) AS setting(key)
                 WHERE profile."Type" = 'Custom'
                   AND NOT EXISTS (SELECT 1 FROM identity."AccessProfileGrants" AS existing
                                    WHERE existing."AccessProfileId" = profile."Id"
                                      AND existing."PermissionKey" = setting.key);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversed: the grants can't be told apart from ones an administrator added since,
            // and holding them is harmless once the settings permissions are gone.
        }
    }
}
