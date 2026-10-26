import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FusionSettingsSection, PeopleDataSettingsDto } from "@repo/api";

const mocks = vi.hoisted(() => ({
  sections: undefined as FusionSettingsSection[] | undefined,
  peopleData: undefined as PeopleDataSettingsDto | undefined,
}));

vi.mock("@repo/api/query", () => ({
  useSettingsSections: () => ({ data: mocks.sections, isError: false, refetch: vi.fn() }),
  useSettingsConflictSaver: () => null,
}));

vi.mock("@/features/settings/api/use-tenant-settings", () => ({
  usePeopleDataSettings: () => ({ data: mocks.peopleData, error: null, refetch: vi.fn() }),
  useUpdatePeopleDataSettings: () => ({ mutateAsync: vi.fn() }),
}));

import { createTranslator } from "next-intl";
import { IntlTestProvider } from "@repo/ds/testing";
import dsFr from "@repo/ds/messages/fr.json";
import { loadCoreMessages } from "@/i18n/messages";
import type { Say } from "./say";
import { describeChange, periodOf } from "./sections/change-history";
import { invitationsConsequence } from "./sections/invitations";
import { roleConsequence } from "./sections/roles";
import { CoreSettingsSectionHost } from "./section-host";
import { EmployeeFieldsSettings, employeeFieldsConsequence, toDraft } from "./sections/employee-fields";

const replace = vi.fn();
Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });

afterEach(() => {
  cleanup();
  replace.mockReset();
});

function section(id: string, access: "view" | "manage"): FusionSettingsSection {
  return { id, label: id === "employee-fields" ? "Employee fields" : "Company", order: 1, path: `/core/settings/${id}`, access, lastChange: null };
}

const PEOPLE_DATA: PeopleDataSettingsDto = {
  version: 3,
  downstreamConsumers: [],
  selfService: { canEditPreferredName: true, canEditPhone: true },
  employeeFieldConfig: {
    firstName: { visible: true, required: true, visibleToEmployee: true, visibleToManager: true },
    lastName: { visible: true, required: true, visibleToEmployee: true, visibleToManager: true },
    email: { visible: true, required: false, visibleToEmployee: true, visibleToManager: true },
    hireDate: { visible: true, required: true, visibleToEmployee: true, visibleToManager: true },
    phone: { visible: true, required: false, visibleToEmployee: true, visibleToManager: false },
    jobTitle: { visible: true, required: false, visibleToEmployee: true, visibleToManager: true },
    workLocation: { visible: true, required: false, visibleToEmployee: true, visibleToManager: true },
    employmentType: { visible: true, required: false, visibleToEmployee: true, visibleToManager: true },
  },
};

describe("Employee fields", () => {
  it("shows a view-only reader every value as text, with no inputs or save bar", () => {
    mocks.peopleData = PEOPLE_DATA;
    render(<EmployeeFieldsSettings section={section("employee-fields", "view")} />);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    const phone = screen.getByRole("row", { name: /Phone/ });
    expect(phone).toHaveTextContent("NoSees itHiddenSees it");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("locks names and gives a manager a checkbox per audience, HR fixed", () => {
    mocks.peopleData = PEOPLE_DATA;
    render(<EmployeeFieldsSettings section={section("employee-fields", "manage")} />);
    expect(screen.getByRole("checkbox", { name: "First name: Required" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Phone: Their manager" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Phone: HR always sees it" })).toBeDisabled();
  });

  it("names the consequence of a change", () => {
    const saved = toDraft({
      ...PEOPLE_DATA,
      employeeFieldConfig: { ...PEOPLE_DATA.employeeFieldConfig, phone: { ...PEOPLE_DATA.employeeFieldConfig.phone!, visibleToManager: true } },
    });
    const draft = toDraft(PEOPLE_DATA);
    expect(employeeFieldsConsequence(saved, draft)).toBe("Managers stop seeing phone numbers on their team's profiles.");
    expect(
      employeeFieldsConsequence(draft, { ...draft, selfService: { ...draft.selfService, canEditPhone: false } })
    ).toBe("Employees can no longer change their phone number.");
  });
});

const fr = await loadCoreMessages("fr");
const french = createTranslator({ locale: "fr", messages: fr, namespace: "settings" });
const sayInFrench: Say = (key, values) => french(key as never, values as never);

describe("In French", () => {
  it("renders Employee fields in French, naming the section from the catalogue", () => {
    mocks.peopleData = PEOPLE_DATA;
    render(
      <IntlTestProvider locale="fr" messages={{ ...dsFr, ...fr }}>
        <EmployeeFieldsSettings section={section("employee-fields", "view")} />
      </IntlTestProvider>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Champs collaborateur" })).toBeInTheDocument();
    expect(screen.getByText("Lecture seule")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Téléphone/ })).toHaveTextContent("NonVisibleMasquéVisible");
  });

  it("says what saving does with French agreement", () => {
    const saved = toDraft(PEOPLE_DATA);
    const draft = toDraft({
      ...PEOPLE_DATA,
      employeeFieldConfig: { ...PEOPLE_DATA.employeeFieldConfig, hireDate: { ...PEOPLE_DATA.employeeFieldConfig.hireDate!, required: false } },
    });
    expect(employeeFieldsConsequence(saved, draft, sayInFrench)).toBe("Date d’embauche n’est plus obligatoire.");
    expect(
      invitationsConsequence(
        { inviteExpiryDays: 7, resendCooldownHours: 24, defaultAccessProfileId: null, pendingInviteBehavior: "RefreshExisting" },
        { inviteExpiryDays: 1, resendCooldownHours: 24, defaultAccessProfileId: null, pendingInviteBehavior: "KeepExisting" },
        "Employee",
        sayInFrench
      )
    ).toBe("Les invitations envoyées à partir de maintenant expirent après 1 jour. Une nouvelle invitation conserve le premier lien.");
    expect(roleConsequence("Recruteur", { calibration: "None" }, { calibration: "Manage" }, sayInFrench)).toBe(
      "Les titulaires du rôle « Recruteur » peuvent gérer le calibrage."
    );
  });

  it("writes change history's lines in French", () => {
    expect(describeChange("employeeFieldConfig.phone.visibleToManager", false, true, sayInFrench)).toEqual({
      label: "Téléphone · son manager",
      before: "Masqué",
      after: "Visible",
      sentence: "Téléphone : les managers le voient désormais",
    });
    expect(describeChange("provisioning.inviteExpiryDays", 7, 14, sayInFrench).after).toBe("14 jours");
    expect(periodOf(new Date(2026, 8, 3), new Date(2026, 9, 24), sayInFrench, "fr")).toBe("Septembre");
    expect(periodOf(new Date(2026, 9, 22), new Date(2026, 9, 24), sayInFrench, "fr")).toBe("Cette semaine");
  });
});

describe("Opening a section", () => {
  it("sends a person who can't view the section to their first allowed one", () => {
    mocks.sections = [section("employee-fields", "view")];
    render(<CoreSettingsSectionHost id="roles" render={() => <p>Roles content</p>} />);
    expect(replace).toHaveBeenCalledWith("/core/settings/employee-fields");
    expect(screen.queryByText("Roles content")).not.toBeInTheDocument();
  });

  it("sends someone with no Core HR section to Preferences", () => {
    mocks.sections = [];
    render(<CoreSettingsSectionHost id="company" render={() => <p>Company</p>} />);
    expect(replace).toHaveBeenCalledWith("/settings");
  });

  it("opens an allowed section", () => {
    mocks.sections = [section("company", "manage")];
    render(<CoreSettingsSectionHost id="company" render={(open) => <p>{open.label} open</p>} />);
    expect(screen.getByText("Company open")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
