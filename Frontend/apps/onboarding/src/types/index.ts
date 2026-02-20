export interface NewHire {
  id: string;
  name: string;
  role: string;
  startDate: string;
  progress: number;
  status: "just-started" | "in-progress" | "completed";
}
