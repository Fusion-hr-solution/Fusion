import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderInFrench, sayInFrench } from "@/test/intl";
import { buildModuleOptions } from "./module-catalogue";
import { localeName } from "./provisioning-options";
import { validateDraft, type ProvisioningDraft } from "./provisioning-form-state";
import { countryName, dateFormatLabel } from "./regional-presentation-options";
import { OrganizationStep } from "./steps/organization-step";
import { ACCEPTED_MODULES } from "@/test/fixtures";

const say = sayInFrench("provisioning");

const DRAFT: ProvisioningDraft = {
  name: "",
  tenantSlug: "Acme Corp",
  legalEntityName: "",
  industry: "Financial Services",
  shortDescription: "",
  timeZone: "Africa/Tunis",
  locale: "",
  country: "TN",
  dateFormat: "DD/MM/YYYY",
  firstName: "",
  lastName: "",
  adminRole: "tenant-hr-admin",
  sendInvitation: true,
  selectedModuleKeys: [],
  administratorEmail: "nope",
};

describe("Provisioning in French", () => {
  it("renders the organization step in French, the stored industry worded for the reader", () => {
    renderInFrench(
      <OrganizationStep
        draft={DRAFT}
        errors={{ name: validateDraft(DRAFT, say).name }}
        update={vi.fn()}
        validateField={vi.fn()}
        toggleModule={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Informations sur l’organisation" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom de l’organisation/)).toBeInTheDocument();
    expect(screen.getByText("Saisissez le nom de l’organisation.")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Services financiers");
  });

  it("explains what is wrong in French", () => {
    expect(validateDraft(DRAFT, say)).toMatchObject({
      tenantSlug: "Utilisez uniquement des minuscules, des chiffres et des tirets.",
      firstName: "Saisissez le prénom de l’administrateur.",
      administratorEmail: "Saisissez une adresse e-mail valide.",
    });
  });

  it("names modules, countries, languages and date patterns in French", () => {
    const core = buildModuleOptions(ACCEPTED_MODULES, say).find((option) => option.key === "core");
    expect(core?.description).toBe("Socle des collaborateurs et de l’organisation");
    expect(countryName("TN", "fr")).toBe("Tunisie");
    expect(localeName("en-US", "fr")).toBe("Anglais (États-Unis)");
    expect(localeName("en-US")).toBe("English (United States)");
    expect(dateFormatLabel("DD/MM/YYYY", "fr")).toBe("JJ/MM/AAAA");
  });
});
