// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@repo/api";

const {
  mockMutateAsync,
  mockToastSuccess,
  mockUseCreateEmployeeRecord,
  mockUseEmployeeFieldPolicy,
  mockUseEmployeeManagerOptions,
  mockUseEmployeeOrgUnitOptions,
} = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseCreateEmployeeRecord: vi.fn(),
  mockUseEmployeeFieldPolicy: vi.fn(),
  mockUseEmployeeManagerOptions: vi.fn(),
  mockUseEmployeeOrgUnitOptions: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

vi.mock("@/features/employees/shared/employee-field-visibility", () => ({
  useEmployeeFieldPolicy: mockUseEmployeeFieldPolicy,
}));

vi.mock("./use-employees", () => ({
  useCreateEmployeeRecord: mockUseCreateEmployeeRecord,
  useEmployeeManagerOptions: mockUseEmployeeManagerOptions,
  useEmployeeOrgUnitOptions: mockUseEmployeeOrgUnitOptions,
}));

import { EmployeeCreateDialog } from "./employee-create-dialog";

beforeEach(() => {
  vi.clearAllMocks();

  mockUseCreateEmployeeRecord.mockReturnValue({
    isLoading: false,
    mutateAsync: mockMutateAsync,
  });
  mockUseEmployeeFieldPolicy.mockReturnValue({
    showHireDate: true,
    showJobTitle: true,
    requireHireDate: true,
    requireJobTitle: false,
  });
  mockUseEmployeeManagerOptions.mockReturnValue({
    data: { items: [] },
    isLoading: false,
    error: null,
  });
  mockUseEmployeeOrgUnitOptions.mockReturnValue({
    data: { items: [] },
    isLoading: false,
    error: null,
  });
});

describe("EmployeeCreateDialog", () => {
  it("keeps the modal slim by removing the legacy create fields", () => {
    render(
      <EmployeeCreateDialog
        open
        onOpenChange={() => undefined}
        onCreated={() => undefined}
      />
    );

    expect(screen.getByLabelText("First name")).toBeTruthy();
    expect(screen.getByLabelText("Last name")).toBeTruthy();
    expect(screen.getByLabelText("Work email")).toBeTruthy();
    expect(screen.getByLabelText("Hire date")).toBeTruthy();
    expect(screen.getByLabelText("Job title")).toBeTruthy();
    expect(screen.queryByLabelText("Employee number")).toBeNull();
    expect(screen.queryByLabelText("Phone")).toBeNull();
    expect(screen.queryByLabelText("Work location")).toBeNull();
    expect(screen.queryByLabelText("Employment type")).toBeNull();
  });

  it("closes on success and defers navigation to the toast action", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    mockMutateAsync.mockResolvedValue({ stableEmployeeKey: "emp-7" });

    render(
      <EmployeeCreateDialog
        open
        onOpenChange={onOpenChange}
        onCreated={onCreated}
      />
    );

    await user.type(screen.getByLabelText("First name"), "Alice");
    await user.type(screen.getByLabelText("Last name"), "Smith");
    await user.type(screen.getByLabelText("Work email"), "Alice.Smith@Example.com");
    fireEvent.change(screen.getByLabelText("Hire date"), {
      target: { value: "2026-06-01" },
    });

    await user.click(screen.getByRole("button", { name: "Add employee" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      firstName: "Alice",
      lastName: "Smith",
      email: "alice.smith@example.com",
      hireDate: "2026-06-01T00:00:00.000Z",
      jobTitle: null,
      managerId: undefined,
      orgUnitId: undefined,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Employee added",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Open profile" }),
        cancel: expect.objectContaining({ label: "Add another" }),
      })
    );

    const toastOptions = mockToastSuccess.mock.calls[0]?.[1] as {
      action?: { onClick?: () => void };
      cancel?: { onClick?: () => void };
    };

    toastOptions.action?.onClick?.();
    expect(onCreated).toHaveBeenCalledWith("emp-7");

    toastOptions.cancel?.onClick?.();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("maps duplicate email conflicts onto the email field", async () => {
    const user = userEvent.setup();

    mockMutateAsync.mockRejectedValue(
      new ApiError(
        409,
        "Conflict",
        ["Employee with email 'alice.smith@example.com' already exists."],
        null
      )
    );

    render(
      <EmployeeCreateDialog
        open
        onOpenChange={() => undefined}
        onCreated={() => undefined}
      />
    );

    await user.type(screen.getByLabelText("First name"), "Alice");
    await user.type(screen.getByLabelText("Last name"), "Smith");
    await user.type(screen.getByLabelText("Work email"), "alice.smith@example.com");
    fireEvent.change(screen.getByLabelText("Hire date"), {
      target: { value: "2026-06-01" },
    });

    await user.click(screen.getByRole("button", { name: "Add employee" }));

    expect(
      await screen.findByText("An employee with this email already exists.")
    ).toBeTruthy();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});