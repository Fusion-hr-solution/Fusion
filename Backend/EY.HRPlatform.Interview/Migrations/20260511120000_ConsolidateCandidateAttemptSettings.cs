using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    public partial class ConsolidateCandidateAttemptSettings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                DECLARE
                    target uuid := '1f8197d0-4b62-4b54-8ed9-7ebf2fb02a51';
                BEGIN
                    IF EXISTS (SELECT 1 FROM "CandidateAttemptSettings" WHERE "Id" = target) THEN
                        DELETE FROM "CandidateAttemptSettings" WHERE "Id" <> target;
                    ELSE
                        UPDATE "CandidateAttemptSettings"
                        SET "Id" = target
                        WHERE "Id" = (
                            SELECT "Id"
                            FROM "CandidateAttemptSettings"
                            ORDER BY "CreatedAt" DESC NULLS LAST, "Id" DESC
                            LIMIT 1
                        );

                        DELETE FROM "CandidateAttemptSettings" WHERE "Id" <> target;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM "CandidateAttemptSettings") THEN
                        INSERT INTO "CandidateAttemptSettings" ("Id", "DefaultMaxAttempts", "CreatedAt", "UpdatedAt")
                        VALUES (target, 0, NOW(), NOW());
                    END IF;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
