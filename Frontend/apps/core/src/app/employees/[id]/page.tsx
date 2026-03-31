"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Skeleton, Card, CardContent, CardHeader } from "@repo/ui";
import { ArrowLeft, UserX } from "lucide-react";
import { getEmployeeById } from "@/services/employee-service";
import { EmployeeProfileCard } from "@/components/employees";
import type { Employee } from "@/types/employee";

export default function EmployeeProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchEmployee() {
      setIsLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const data = await getEmployeeById(id);
        if (!cancelled) {
          setEmployee(data);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message.includes("404")) {
            setNotFound(true);
          } else {
            setError(
              err instanceof Error ? err.message : "Failed to load employee"
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchEmployee();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-5">
            <UserX className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            Employee not found
          </h2>
          <p className="text-muted-foreground mb-8">
            The employee you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <Button asChild variant="outline">
            <Link href="/core/employees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Directory
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-xl font-semibold mb-2">Failed to load employee</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild variant="outline">
            <Link href="/core/employees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Directory
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/core/employees">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Directory
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mt-4">
          Employee Profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          View employee details and information
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : employee ? (
        <EmployeeProfileCard employee={employee} />
      ) : null}
    </div>
  );
}
