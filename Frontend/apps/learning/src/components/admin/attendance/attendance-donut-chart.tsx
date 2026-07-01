"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";

interface AttendanceDonutChartProps {
  present: number;
  absent: number;
  pending: number;
}

const COLORS = {
  present: "hsl(var(--ey-green-500))",
  absent: "hsl(var(--ey-red-500))",
  pending: "hsl(var(--ey-orange-500))",
};

/** Present / Absent / Pending breakdown for a single session (AC#1). */
export function AttendanceDonutChart({
  present,
  absent,
  pending,
}: AttendanceDonutChartProps) {
  const t = useTranslations("adminAttendance");
  const data = [
    { name: t("donut.present"), value: present, key: "present" as const },
    { name: t("donut.absent"), value: absent, key: "absent" as const },
    { name: t("donut.pending"), value: pending, key: "pending" as const },
  ].filter((d) => d.value > 0);

  const total = present + absent + pending;

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
        {t("donut.empty")}
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={COLORS[entry.key]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value}`, name]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
