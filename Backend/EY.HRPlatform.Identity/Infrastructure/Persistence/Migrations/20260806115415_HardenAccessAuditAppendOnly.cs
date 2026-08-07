using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Makes append-only access audit a guarantee rather than an attempt.
    /// <para>
    /// The earlier revoke targeted <c>current_user</c> — the principal running the
    /// migration, which in every real deployment is not the principal the service
    /// runs as — and downgraded a failed revoke to a notice. Both together meant a
    /// deployment could report success while the application role kept UPDATE and
    /// DELETE on the evidence trail, which is the one thing the rule exists to
    /// prevent.
    /// </para>
    /// <para>
    /// The runtime role is named explicitly through <c>Identity:AuditRuntimeRole</c>
    /// (env <c>Identity__AuditRuntimeRole</c>). The revoke is verified afterwards,
    /// and a role that still holds the privilege fails the migration. A superuser
    /// bypasses table ACLs entirely, so it cannot be constrained this way and is
    /// reported as such instead of being silently accepted as enforced.
    /// </para>
    /// </summary>
    public partial class HardenAccessAuditAppendOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var runtimeRole =
                System.Environment.GetEnvironmentVariable("Identity__AuditRuntimeRole");

            var roleExpression = string.IsNullOrWhiteSpace(runtimeRole)
                ? "current_user"
                : Quote(runtimeRole);

            migrationBuilder.Sql($"""
                DO $$
                DECLARE
                    target_role text := {roleExpression};
                    is_superuser boolean;
                    still_writable boolean;
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
                        RAISE EXCEPTION
                            'Append-only audit cannot be enforced: role % does not exist. Set Identity__AuditRuntimeRole to the role the Identity service connects as.',
                            target_role;
                    END IF;

                    EXECUTE format(
                        'REVOKE UPDATE, DELETE ON identity."AccessAuditEvents" FROM %I',
                        target_role);

                    SELECT rolsuper INTO is_superuser FROM pg_roles WHERE rolname = target_role;

                    SELECT has_table_privilege(target_role, 'identity."AccessAuditEvents"', 'UPDATE')
                        OR has_table_privilege(target_role, 'identity."AccessAuditEvents"', 'DELETE')
                      INTO still_writable;

                    IF still_writable AND is_superuser THEN
                        -- Truthful rather than reassuring: a superuser bypasses table
                        -- ACLs, so no revoke can hold. Local development commonly runs
                        -- this way; a deployment must not.
                        RAISE WARNING
                            'Access audit is NOT append-only: % is a superuser and bypasses table privileges. Run the Identity service as a non-superuser role and set Identity__AuditRuntimeRole.',
                            target_role;
                    ELSIF still_writable THEN
                        RAISE EXCEPTION
                            'Append-only audit could not be enforced: % still holds UPDATE or DELETE on identity."AccessAuditEvents".',
                            target_role;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var runtimeRole =
                System.Environment.GetEnvironmentVariable("Identity__AuditRuntimeRole");

            var roleExpression = string.IsNullOrWhiteSpace(runtimeRole)
                ? "current_user"
                : Quote(runtimeRole);

            migrationBuilder.Sql($"""
                DO $$
                DECLARE
                    target_role text := {roleExpression};
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
                        EXECUTE format(
                            'GRANT UPDATE, DELETE ON identity."AccessAuditEvents" TO %I',
                            target_role);
                    END IF;
                END $$;
                """);
        }

        /// <summary>Renders a role name as a SQL string literal.</summary>
        private static string Quote(string value)
            => $"'{value.Trim().Replace("'", "''")}'";
    }
}
