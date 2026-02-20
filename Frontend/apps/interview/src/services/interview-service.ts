import { type Interview } from "@/types";

/** Mock data — replace with actual API calls */
const MOCK_INTERVIEWS: Interview[] = [
  {
    id: "1",
    candidate: "Alice Johnson",
    role: "Senior Frontend Engineer",
    status: "scheduled",
    date: "2026-02-20",
  },
  {
    id: "2",
    candidate: "Bob Smith",
    role: "Full Stack Developer",
    status: "in-progress",
    date: "2026-02-18",
  },
  {
    id: "3",
    candidate: "Carol Williams",
    role: "UX Designer",
    status: "completed",
    date: "2026-02-15",
  },
];

export async function getInterviews(): Promise<Interview[]> {
  // TODO: Replace with actual API call
  return MOCK_INTERVIEWS;
}

export async function getInterviewById(
  id: string
): Promise<Interview | undefined> {
  return MOCK_INTERVIEWS.find((i) => i.id === id);
}
