import type {
  Employee,
  EmployeeListItem,
  EmployeesPagedResult,
  EmployeeFilters,
} from "@/types/employee";

// Mock data for development
const MOCK_EMPLOYEES: EmployeeListItem[] = [
  {
    id: "emp-001",
    firstName: "Sarah",
    lastName: "Chen",
    fullName: "Sarah Chen",
    email: "sarah.chen@ey-hr.com",
    department: "Engineering",
    jobTitle: "Senior Software Engineer",
    status: "active",
    hireDate: "2023-01-15",
    managerId: "emp-002",
    managerName: "James Wilson",
  },
  {
    id: "emp-002",
    firstName: "James",
    lastName: "Wilson",
    fullName: "James Wilson",
    email: "james.wilson@ey-hr.com",
    department: "Engineering",
    jobTitle: "Tech Lead",
    status: "active",
    hireDate: "2022-06-01",
    managerId: "emp-008",
    managerName: "Robert Taylor",
  },
  {
    id: "emp-003",
    firstName: "Maria",
    lastName: "Garcia",
    fullName: "Maria Garcia",
    email: "maria.garcia@ey-hr.com",
    department: "Human Resources",
    jobTitle: "HR Manager",
    status: "active",
    hireDate: "2021-03-10",
    managerId: null,
    managerName: null,
  },
  {
    id: "emp-004",
    firstName: "David",
    lastName: "Kim",
    fullName: "David Kim",
    email: "david.kim@ey-hr.com",
    department: "Finance",
    jobTitle: "Financial Analyst",
    status: "active",
    hireDate: "2023-08-20",
    managerId: "emp-006",
    managerName: "Lisa Brown",
  },
  {
    id: "emp-005",
    firstName: "Emily",
    lastName: "Johnson",
    fullName: "Emily Johnson",
    email: "emily.johnson@ey-hr.com",
    department: "Marketing",
    jobTitle: "Marketing Specialist",
    status: "inactive",
    hireDate: "2022-02-14",
    managerId: "emp-007",
    managerName: "Michael Lee",
  },
  {
    id: "emp-006",
    firstName: "Lisa",
    lastName: "Brown",
    fullName: "Lisa Brown",
    email: "lisa.brown@ey-hr.com",
    department: "Finance",
    jobTitle: "Finance Director",
    status: "active",
    hireDate: "2020-11-01",
    managerId: null,
    managerName: null,
  },
  {
    id: "emp-007",
    firstName: "Michael",
    lastName: "Lee",
    fullName: "Michael Lee",
    email: "michael.lee@ey-hr.com",
    department: "Marketing",
    jobTitle: "Marketing Director",
    status: "active",
    hireDate: "2019-07-15",
    managerId: null,
    managerName: null,
  },
  {
    id: "emp-008",
    firstName: "Robert",
    lastName: "Taylor",
    fullName: "Robert Taylor",
    email: "robert.taylor@ey-hr.com",
    department: "Engineering",
    jobTitle: "VP of Engineering",
    status: "active",
    hireDate: "2018-03-01",
    managerId: null,
    managerName: null,
  },
];

const MOCK_EMPLOYEE_DETAILS: Record<string, Employee> = Object.fromEntries(
  MOCK_EMPLOYEES.map((emp, i) => [
    emp.id,
    {
      ...emp,
      manager: [
        {
          id: "emp-002",
          firstName: "James",
          lastName: "Wilson",
          fullName: "James Wilson",
          email: "james.wilson@ey-hr.com",
        },
        {
          id: "emp-008",
          firstName: "Robert",
          lastName: "Taylor",
          fullName: "Robert Taylor",
          email: "robert.taylor@ey-hr.com",
        },
        null,
        {
          id: "emp-006",
          firstName: "Lisa",
          lastName: "Brown",
          fullName: "Lisa Brown",
          email: "lisa.brown@ey-hr.com",
        },
        {
          id: "emp-007",
          firstName: "Michael",
          lastName: "Lee",
          fullName: "Michael Lee",
          email: "michael.lee@ey-hr.com",
        },
        null,
        null,
        null,
      ][i] ?? null,
    } as Employee,
  ])
);

/** Get paginated list of employees */
export async function getEmployees(
  filters: EmployeeFilters = {}
): Promise<EmployeesPagedResult> {
  const { page = 1, pageSize = 10 } = filters;

  // For now, return mock data
  // TODO: integrate with backend API when ready
  let items = [...MOCK_EMPLOYEES];

  // Filter by search
  if (filters.search) {
    const search = filters.search.toLowerCase();
    items = items.filter(
      (e) =>
        e.fullName.toLowerCase().includes(search) ||
        e.email.toLowerCase().includes(search) ||
        e.department?.toLowerCase().includes(search)
    );
  }

  // Filter by department
  if (filters.department) {
    items = items.filter((e) => e.department === filters.department);
  }

  // Filter by status
  if (filters.status) {
    items = items.filter((e) => e.status === filters.status);
  }

  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/** Get a single employee by ID */
export async function getEmployeeById(id: string): Promise<Employee> {
  const employee = MOCK_EMPLOYEE_DETAILS[id];
  if (!employee) {
    throw new Error(`Employee not found (404)`);
  }
  return employee;
}

/** Get unique departments from employees */
export async function getDepartments(): Promise<string[]> {
  const departments = new Set<string>();
  MOCK_EMPLOYEES.forEach((e) => {
    if (e.department) departments.add(e.department);
  });
  return Array.from(departments).sort();
}
