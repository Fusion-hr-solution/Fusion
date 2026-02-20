export interface JobOpening {
  id: string;
  title: string;
  department: string;
  applicants: number;
  status: "active" | "closing-soon" | "closed";
}
