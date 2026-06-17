"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Pencil,
  UserCog,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { Button, Badge, Card, CardContent } from "@repo/ui";
import Link from "next/link";
import { useApiQuery } from "@repo/api/react";
import {
  getEmployeeProfiles,
  getIdentityUsers,
} from "@/services/admin-service";
import { EmployeeProfileForm } from "./employee-profile-form";

export function EmployeeProfilesManager() {
  const t = useTranslations("adminEmployees");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchProfiles = useCallback(
    () => getEmployeeProfiles(page, pageSize),
    [page, pageSize]
  );
  const { data, isLoading, refetch } = useApiQuery(fetchProfiles, {
    enabled: true,
  });

  const fetchUsers = useCallback(() => getIdentityUsers(), []);
  const { data: identityUsers } = useApiQuery(fetchUsers, { enabled: true });

  const userMap = useMemo(() => {
    const map = new Map<string, { fullName: string; email: string }>();
    for (const u of identityUsers ?? []) {
      map.set(u.id.toLowerCase(), { fullName: u.fullName, email: u.email });
    }
    return map;
  }, [identityUsers]);

  const profiles = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {t("loading")}
        </div>
      ) : !profiles.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {profiles.map((profile) =>
              editingId === profile.employeeId ? (
                <EmployeeProfileForm
                  key={profile.employeeId}
                  profile={profile}
                  onSaved={() => {
                    setEditingId(null);
                    refetch();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <Card key={profile.employeeId} className="border-border/60">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div>
                        {(() => {
                          const user = userMap.get(
                            profile.employeeId.toLowerCase()
                          );
                          return (
                            <>
                              <p className="text-sm font-medium">
                                {user?.fullName ?? profile.employeeId}
                              </p>
                              {user?.email && (
                                <p className="text-xs text-muted-foreground">
                                  {user.email}
                                </p>
                              )}
                            </>
                          );
                        })()}
                        <div className="mt-1 flex items-center gap-2">
                          {profile.gradeName ? (
                            <Badge variant="secondary" className="text-xs">
                              {profile.gradeName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("noGrade")}
                            </span>
                          )}
                          {profile.serviceLineName ? (
                            <Badge variant="outline" className="text-xs gap-1">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    profile.serviceLineColor ?? undefined,
                                }}
                              />
                              {profile.serviceLineName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("noServiceLine")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        aria-label={t("viewAttendanceAria", {
                          name:
                            userMap.get(profile.employeeId.toLowerCase())
                              ?.fullName ?? profile.employeeId,
                        })}
                      >
                        <Link
                          href={`/admin/employees/${profile.employeeId}/attendance`}
                        >
                          <BarChart2 className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(profile.employeeId)}
                        aria-label={t("editAria", {
                          name:
                            userMap.get(profile.employeeId.toLowerCase())
                              ?.fullName ?? profile.employeeId,
                        })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("profilesCount", { count: totalCount })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{t("pageOf", { page, totalPages })}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
