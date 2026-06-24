using System.Security.Claims;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Services;

public interface ISettingsSectionRegistry
{
    IReadOnlyList<SettingsSectionDto> GetVisibleSections(ClaimsPrincipal user);
}

public sealed class SettingsSectionRegistry(ICoreAccessPolicyService accessPolicy) : ISettingsSectionRegistry
{
    public IReadOnlyList<SettingsSectionDto> GetVisibleSections(ClaimsPrincipal user)
        => AllSections
            .Select(section => section with
            {
                CanView = section.Id switch
                {
                    SettingsSectionIds.Overview => accessPolicy.CanViewSettings(user),
                    SettingsSectionIds.Organization => accessPolicy.CanViewOrganizationSettings(user),
                    SettingsSectionIds.PeopleData => accessPolicy.CanViewPeopleDataSettings(user),
                    SettingsSectionIds.Structure => accessPolicy.CanViewStructureSettings(user),
                    SettingsSectionIds.AccessPermissions => accessPolicy.CanViewAccessProfiles(user),
                    SettingsSectionIds.Provisioning => accessPolicy.CanViewProvisioningSettings(user),
                    SettingsSectionIds.Governance => accessPolicy.CanViewGovernanceSettings(user),
                    _ => false,
                },
                CanManage = section.Id switch
                {
                    SettingsSectionIds.Organization => accessPolicy.CanManageOrganizationSettings(user),
                    SettingsSectionIds.PeopleData => accessPolicy.CanManagePeopleDataSettings(user),
                    SettingsSectionIds.Structure => accessPolicy.CanManageStructureSettings(user),
                    SettingsSectionIds.AccessPermissions => accessPolicy.CanManageAccessProfiles(user),
                    SettingsSectionIds.Provisioning => accessPolicy.CanManageProvisioningSettings(user),
                    _ => false,
                },
            })
            .Where(section => section.Enabled && section.CanView)
            .OrderBy(section => section.Order)
            .ToList();

    private static readonly IReadOnlyList<SettingsSectionDto> AllSections =
    [
        new(
            SettingsSectionIds.Overview,
            "core",
            "foundation",
            "Overview",
            "Visible administration areas, setup health, and recent sensitive changes.",
            true,
            "ready",
            "Core",
            "Core",
            "core.settings.overview",
            0,
            false,
            false,
            [CorePermissions.SettingsGovernanceView],
            []),
        new(
            SettingsSectionIds.Organization,
            "core",
            "foundation",
            "Organization",
            "Tenant display defaults and branding.",
            true,
            "ready",
            "Core",
            "Core",
            "core.settings.organization",
            10,
            false,
            false,
            [CorePermissions.SettingsOrganizationView],
            [CorePermissions.SettingsOrganizationManage]),
        new(
            SettingsSectionIds.PeopleData,
            "core",
            "foundation",
            "People data",
            "Employee field schema, visibility, required rules, and self-service policy.",
            true,
            "ready",
            "Core",
            "Core",
            "core.settings.people-data",
            20,
            false,
            false,
            [CorePermissions.SettingsPeopleDataView],
            [CorePermissions.SettingsPeopleDataManage]),
        new(
            SettingsSectionIds.Structure,
            "core",
            "foundation",
            "Organization structure",
            "Org-unit schema and hierarchy governance with operational handoff to Setup and Org Chart.",
            true,
            "ready",
            "Core",
            "Core",
            "core.settings.structure",
            30,
            false,
            false,
            [CorePermissions.SettingsStructureView],
            [CorePermissions.SettingsStructureManage]),
        new(
            SettingsSectionIds.AccessPermissions,
            "identity",
            "foundation",
            "Access & permissions",
            "Permission catalog and access profile definitions. Assignments remain in Access.",
            true,
            "ready",
            "Identity",
            "Identity",
            "identity.access-profiles",
            40,
            false,
            false,
            [CorePermissions.AccessProfilesView],
            [CorePermissions.AccessProfilesManageV2]),
        new(
            SettingsSectionIds.Provisioning,
            "core",
            "foundation",
            "Provisioning",
            "Invite defaults, default access profile behavior, expiry, and resend policy.",
            true,
            "ready",
            "Core",
            "Core",
            "core.settings.provisioning",
            50,
            false,
            false,
            [CorePermissions.SettingsProvisioningView],
            [CorePermissions.SettingsProvisioningManage]),
        new(
            SettingsSectionIds.Governance,
            "core",
            "foundation",
            "Governance",
            "Sensitive settings history and audit details.",
            true,
            "ready",
            "Core",
            "Core",
            "core.settings.governance",
            60,
            false,
            false,
            [CorePermissions.SettingsGovernanceView],
            []),
    ];
}
