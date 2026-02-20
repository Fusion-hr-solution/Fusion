export interface Interview {
  id: string;
  candidate: string;
  role: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  date: string;
}
