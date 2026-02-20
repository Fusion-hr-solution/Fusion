import { type NewHire } from "@/types";

const MOCK_NEW_HIRES: NewHire[] = [
  {
    id: "1",
    name: "Emily Davis",
    role: "Frontend Developer",
    startDate: "2026-03-01",
    progress: 65,
    status: "in-progress",
  },
  {
    id: "2",
    name: "Michael Brown",
    role: "Backend Engineer",
    startDate: "2026-02-24",
    progress: 30,
    status: "just-started",
  },
  {
    id: "3",
    name: "Lisa Anderson",
    role: "QA Engineer",
    startDate: "2026-02-10",
    progress: 100,
    status: "completed",
  },
];

export async function getNewHires(): Promise<NewHire[]> {
  // TODO: Replace with actual API call
  return MOCK_NEW_HIRES;
}
