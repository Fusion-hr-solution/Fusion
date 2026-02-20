import { type JobOpening } from "@/types";

const MOCK_OPENINGS: JobOpening[] = [
  {
    id: "1",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    applicants: 42,
    status: "active",
  },
  {
    id: "2",
    title: "Product Designer",
    department: "Design",
    applicants: 28,
    status: "active",
  },
  {
    id: "3",
    title: "DevOps Engineer",
    department: "Infrastructure",
    applicants: 15,
    status: "closing-soon",
  },
];

export async function getJobOpenings(): Promise<JobOpening[]> {
  // TODO: Replace with actual API call
  return MOCK_OPENINGS;
}
