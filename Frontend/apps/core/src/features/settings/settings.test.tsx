import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import type { FieldVisibility, FusionSettingsSection, PeopleDataSettingsDto } from "@repo/api";

const mocks = vi.hoisted(() => ({
  sections: undefined as FusionSettingsSection[] | undefined,
  peopleData: undefined as PeopleDataSettingsDto | undefined,
  visibility: undefined as FieldVisibility | undefined,
  visibilityEnabled: [] as boolean[],
}));

vi.mock("@repo/api/query", () => ({
  useSettingsSections: () => ({ data: mocks.sections, isError: false, refetch: vi.fn() }),
  useSettingsConflictSaver: () => null,
  useFieldVisibility: (options: { enabled?: boolean } = {}) => {
    mocks.visibilityEnabled.push(options.enabled ?? true);
    return { data: mocks.visibility };
  },
}));

vi.mock("@/features/settings/api/use-tenant-settings", () => ({
  usePeopleDataSettings: () => ({ data: mocks.peopleData, error: null, refetch: vi.fn() }),
  useUpdatePeopleDataSettings: () => ({ mutateAsync: vi.fn() }),
}));

import { CoreSettingsSectionHost } from "./section-host";
import { EmployeeFieldsSettings, employeeFieldsConsequence, toDraft } from "./sections/employee-fields";
import { useEmployeeFieldPolicy } from "@/features/employees/shared/employee-field-visibility";

const replace = vi.fn();
Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });

afterEach(() => {
  cleanup();
  replace.mockReset();
  mocks.visibilityEnabled = [];
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

describe("Profiles", () => {
  it("apply the field policy from the field-visibility read, which needs no settings permission", () => {
    mocks.visibility = {
      fields: { phone: { required: false, visibleToEmployee: true, visibleToManager: false } },
      selfService: { canEditPreferredName: true, canEditPhone: false },
    };
    const manager = renderHook(() => useEmployeeFieldPolicy(true, "manager"));
    const employee = renderHook(() => useEmployeeFieldPolicy(true, "employee"));
    expect(manager.result.current.showPhone).toBe(false);
    expect(employee.result.current.showPhone).toBe(true);
    expect(mocks.visibilityEnabled).toContain(true);
  });
});
