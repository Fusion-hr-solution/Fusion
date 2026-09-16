// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
} from "@/app/(pages)/employees/employee-roster.types";
import { WorkerProfile } from "./worker-profile";
import { fromSelfDetails } from "./worker-profile-view";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const details: EmployeeDetailsDto = {
  id: "employee-1",
  tenantId: "tenant-1",
  stableEmployeeKey: "AST-1001",
  employeeNumber: "AST-1001",
  firstName: "Amina",
  lastName: "Mestiri",
  preferredName: null,
  email: "amina@asteria.example",
  phone: "+216 20 000 000",
  currentEmployment: {
    employmentId: "employment-1",
    effectiveFrom: "2023-02-01",
    effectiveTo: null,
    status: "Active",
    employmentType: "FullTime",
  },
  currentWorkAssignment: {
    workAssignmentId: "assignment-1",
    employmentId: "employment-1",
    orgUnitId: "unit-1",
    orgUnitName: "Customer Success",
    orgUnitType: "Department",
    jobTitle: "Customer Success Manager",
    workLocation: "Tunis",
    isPrimary: true,
    effectiveFrom: "2023-02-01",
    effectiveTo: null,
  },
  currentManager: {
    relationshipId: "relationship-1",
    managerEmployeeId: "manager-1",
    managerStableEmployeeKey: "AST-1000",
    managerWorkAssignmentId: "manager-assignment-1",
    managerFirstName: "Alexandre",
    managerLastName: "Idrissi",
    managerEmail: "alexandre@asteria.example",
    effectiveFrom: "2023-02-01",
    effectiveTo: null,
    managerFullName: "Alexandre Idrissi",
  },
  historySummary: {
    employmentCount: 1,
    workAssignmentCount: 1,
    managerRelationshipCount: 1,
  },
  readiness: {
    employeeStateIssueCount: 0,
    blockingIssueCount: 0,
    employeeStateIssues: [],
    blockingIssues: [],
    hasEmployeeStateIssues: false,
    hasBlockingIssues: false,
  },
  createdAt: "2023-02-01T10:00:00Z",
  updatedAt: null,
  version: 3,
  fullName: "Amina Mestiri",
  displayName: "Amina Mestiri",
};

const reportingLines: EmployeeReportingLinesDto = {
  employee: {} as EmployeeReportingLinesDto["employee"],
  managerChain: [],
  directReports: [
    {
      depth: 1,
      employee: {
        id: "report-1",
        stableEmployeeKey: "AST-1002",
        employeeNumber: "AST-1002",
        displayName: "Sami Trabelsi",
        fullName: "Sami Trabelsi",
        firstName: "Sami",
        lastName: "Trabelsi",
        email: "sami@asteria.example",
        orgUnitId: "unit-1",
        orgUnitName: "Customer Success",
        jobTitle: "Consultant",
        status: "Active",
        hireDate: "2024-01-01",
        managerId: "employee-1",
        managerName: "Amina Mestiri",
        hierarchyStatus: "Healthy",
        directReportCount: 0,
        readiness: details.readiness,
        version: 1,
      },
    },
  ],
  downline: [],
  directReportCount: 1,
  downlineCount: 1,
};

describe("WorkerProfile (self projection)", () => {
  it("anchors the worker record, manager, and team from the self view", () => {
    const view = fromSelfDetails(details, reportingLines, {});
    render(<WorkerProfile view={view} eyebrow="Profile" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Amina Mestiri" })
    ).toBeInTheDocument();
    expect(screen.getByText("Current assignment")).toBeInTheDocument();
    expect(screen.getByText("Employment")).toBeInTheDocument();
    expect(screen.getAllByText("Alexandre Idrissi").length).toBeGreaterThan(0);
    expect(screen.getByText("Direct reports · 1")).toBeInTheDocument();
    expect(screen.getByText("Sami Trabelsi")).toBeInTheDocument();
    // manager and reports deep-link into the shared people profile route
    expect(
      screen.getAllByRole("link", { name: /Alexandre Idrissi/ })[0]
    ).toHaveAttribute("href", "/people/AST-1000");
    expect(screen.getByRole("link", { name: /Sami Trabelsi/ })).toHaveAttribute(
      "href",
      "/people/AST-1002"
    );
  });

  it("hides the Fusion access and History cards until self-context loads", () => {
    const view = fromSelfDetails(details, reportingLines, {});
    render(<WorkerProfile view={view} eyebrow="Profile" />);

    expect(screen.queryByText("Fusion access")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });

  it("renders the rich self access facts once context is present", () => {
    const view = fromSelfDetails(details, reportingLines, {
      access: {
        state: "Active",
        label: "Active",
        linkedEmail: "amina@asteria.example",
        accessProfiles: ["Employee"],
        lastSignInAt: "2026-09-10T08:00:00Z",
      },
    });
    render(<WorkerProfile view={view} eyebrow="Profile" accessState="ready" />);

    expect(screen.getByText("Fusion access")).toBeInTheDocument();
    expect(screen.getByText("Last sign-in")).toBeInTheDocument();
    expect(screen.getByText("Access profile")).toBeInTheDocument();
  });
});
