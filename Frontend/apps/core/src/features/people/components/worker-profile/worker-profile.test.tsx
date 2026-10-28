// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
} from "@/features/people/api/employee-roster.types";
import type { PeopleTimelineEventDto } from "@repo/api";
import { ProfileTimeline } from "./job-tab";
import { WorkerProfile } from "./worker-profile";
import { fromSelfDetails, tenure } from "./worker-profile-view";

vi.mock("@repo/api/query", () => ({ usePhoto: () => null }));

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

describe("WorkerProfile", () => {
  const tabs = [
    { key: "job" as const, label: "Job", href: "/profile" },
    { key: "personal" as const, label: "Personal", href: "/profile?tab=personal" },
  ];

  it("shows the band, the tabs and a rail with the manager, team and hire date", () => {
    const view = fromSelfDetails(details, reportingLines, {});
    render(<WorkerProfile view={view} tabs={tabs} currentTab="personal" />);

    expect(screen.getByRole("heading", { level: 1, name: "Amina Mestiri" })).toBeInTheDocument();
    expect(screen.getByText("Customer Success Manager")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Personal" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Job" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Hire date")).toBeInTheDocument();
    expect(screen.getByText("1 February 2023")).toBeInTheDocument();
    expect(screen.getByText("Full-time")).toBeInTheDocument();
    // manager and reports deep-link into the people profile route
    expect(screen.getByRole("link", { name: /Alexandre Idrissi/ })).toHaveAttribute("href", "/people/AST-1000");
    expect(screen.getByRole("link", { name: /Sami Trabelsi/ })).toHaveAttribute("href", "/people/AST-1002");
  });

  it("gives a colleague outside the branch the reporting line in place of tabs", () => {
    const view = fromSelfDetails(details, reportingLines, {});
    render(<WorkerProfile view={view} />);

    expect(screen.queryByRole("navigation", { name: "Profile sections" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reporting line" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Alexandre Idrissi/ })).toBeInTheDocument();
  });

  it("shows teammates for someone without reports", () => {
    const view = fromSelfDetails(details, undefined, {});
    render(
      <WorkerProfile
        view={view}
        tabs={tabs}
        currentTab="job"
        teammates={[{ name: "Leila Baccouche", href: "/people/AST-1003" }]}
      />
    );
    expect(screen.getByText("Teammates")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Leila Baccouche/ })).toHaveAttribute("href", "/people/AST-1003");
  });
});

describe("ProfileTimeline", () => {
  it("names the sections of a contact details update, never values", () => {
    render(
      <ProfileTimeline
        events={[
          {
            kind: "PersonalDetails",
            employeeKey: "AST-1001",
            effectiveDate: "2026-10-28",
            title: "Updated contact details",
            fields: [
              { label: "Mobile", from: null, to: null },
              { label: "Home address", from: null, to: null },
            ],
            isFuture: false,
          } as PeopleTimelineEventDto,
        ]}
      />
    );
    expect(screen.getByText("Updated contact details")).toBeInTheDocument();
    expect(screen.getByText("Mobile, Home address")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});

describe("tenure", () => {
  it("counts whole years, months and days", () => {
    expect(tenure("2020-06-06", new Date(2026, 9, 28))).toEqual({ years: 6, months: 4, days: 22 });
    expect(tenure("2026-10-30", new Date(2026, 9, 28))).toBeNull();
    expect(tenure(null)).toBeNull();
  });
});
