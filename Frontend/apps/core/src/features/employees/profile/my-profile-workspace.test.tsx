// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
} from "@/app/(pages)/employees/employee-roster.types";
import { MyProfileWorkspace } from "./my-profile-workspace";

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

vi.mock("@/app/(pages)/employees/use-employees", () => ({
  useUpdateMyProfile: () => ({ isLoading: false, mutateAsync: vi.fn() }),
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

describe("MyProfileWorkspace", () => {
  it("anchors the worker record, manager relationship, and team without internal record metadata", () => {
    render(
      <MyProfileWorkspace
        details={details}
        reportingLines={reportingLines}
        canEditPreferredName
        canEditPhone
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Profile" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Amina Mestiri" })
    ).toBeInTheDocument();
    expect(screen.getByText("Current assignment")).toBeInTheDocument();
    expect(screen.getByText("Employment")).toBeInTheDocument();
    expect(screen.getAllByText("Alexandre Idrissi").length).toBeGreaterThan(0);
    expect(screen.getByText("Direct reports · 1")).toBeInTheDocument();
    expect(screen.getByText("Sami Trabelsi")).toBeInTheDocument();
    // Internal record metadata never leaks onto the self-service profile.
    expect(screen.queryByText("Full name")).not.toBeInTheDocument();
    expect(screen.queryByText("Record health")).not.toBeInTheDocument();
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });

  it("hides the Fusion access and Assignment history cards until self-context loads", () => {
    render(
      <MyProfileWorkspace
        details={details}
        reportingLines={reportingLines}
        canEditPreferredName
        canEditPhone
      />
    );

    expect(screen.queryByText("Fusion access")).not.toBeInTheDocument();
    expect(screen.queryByText("Employment timeline")).not.toBeInTheDocument();
  });
});
