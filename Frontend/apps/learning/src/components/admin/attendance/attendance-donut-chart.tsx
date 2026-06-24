"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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
export function AttendanceDonutChart({ present, absent, pending }: AttendanceDonutChartProps) {
  const data = [
    { name: "Present", value: present, key: "present" as const },
    { name: "Absent", value: absent, key: "absent" as const },
    { name: "Pending", value: pending, key: "pending" as const },
  ].filter((d) => d.value > 0);

  const total = present + absent + pending;

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
        No enrolled participants yet.
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
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: "12px",
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
