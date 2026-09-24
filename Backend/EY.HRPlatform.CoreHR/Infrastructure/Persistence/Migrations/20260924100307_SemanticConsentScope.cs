using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SemanticConsentScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_OrganizationImportSemanticConsents_Tenant_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents");

            migrationBuilder.AddColumn<Guid>(
                name: "SessionId",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationImportSemanticConsents_Session_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents",
                columns: new[] { "TenantId", "SessionId", "Provider", "DataContractVersion" },
                unique: true,
                filter: "\"RevokedAt\" IS NULL AND \"SessionId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationImportSemanticConsents_Tenant_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents",
                columns: new[] { "TenantId", "Provider", "DataContractVersion" },
                unique: true,
                filter: "\"RevokedAt\" IS NULL AND \"SessionId\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_OrganizationImportSemanticConsents_Session_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents");

            migrationBuilder.DropIndex(
                name: "UX_OrganizationImportSemanticConsents_Tenant_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents");

            migrationBuilder.DropColumn(
                name: "SessionId",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents");

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationImportSemanticConsents_Tenant_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents",
                columns: new[] { "TenantId", "Provider", "DataContractVersion" },
                unique: true,
                filter: "\"RevokedAt\" IS NULL");
        }
    }
}
