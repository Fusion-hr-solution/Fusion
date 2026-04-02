import {
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import type { AdminAssignment } from "@/types/admin";

interface AssignmentsTableProps {
  assignments: AdminAssignment[];
}

function statusColor(status: string) {
  switch (status) {
    case "InProgress":
      return "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))] border-[hsl(var(--ey-blue-400))]/25";
    case "Completed":
      return "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))] border-[hsl(var(--ey-green-500))]/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "InProgress": return "In Progress";
    case "Completed": return "Completed";
    default: return "Not Started";
  }
}

export function AssignmentsTable({ assignments }: AssignmentsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Employee ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-center">Progress</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignments.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {a.employeeId.slice(0, 8)}...
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs capitalize">{a.assignmentType}</Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>
                {statusLabel(a.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[hsl(var(--ey-blue-500))] transition-all" style={{ width: `${a.progressPercentage}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{a.progressPercentage}%</span>
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(a.assignedAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
