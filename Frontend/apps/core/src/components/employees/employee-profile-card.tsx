import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
  Badge,
} from "@repo/ui";
import { Mail, Building2, Briefcase, Calendar } from "lucide-react";
import type { Employee } from "@/types/employee";

interface EmployeeProfileCardProps {
  employee: Employee;
}

export function EmployeeProfileCard({ employee }: EmployeeProfileCardProps) {
  const initials =
    `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">{employee.fullName}</CardTitle>
            <Badge
              variant={employee.status === "active" ? "default" : "secondary"}
            >
              {employee.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {employee.jobTitle ?? "No title"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoItem icon={Mail} label="Email" value={employee.email} />
          <InfoItem
            icon={Building2}
            label="Department"
            value={employee.department ?? "—"}
          />
          <InfoItem
            icon={Briefcase}
            label="Job Title"
            value={employee.jobTitle ?? "—"}
          />
          <InfoItem
            icon={Calendar}
            label="Hire Date"
            value={new Date(employee.hireDate).toLocaleDateString()}
          />
        </div>

        {employee.manager && (
          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Reports to
            </h3>
            <Link
              href={`/core/employees/${employee.manager.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {employee.manager.firstName[0]}
                  {employee.manager.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{employee.manager.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {employee.manager.email}
                </p>
              </div>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
