import { ClipboardList, Activity, Hash, Users } from "lucide-react";
import { MOCK_TESTS } from "@/services/test-service";

export function StatsRow() {
  const total = MOCK_TESTS.length;
  const active = MOCK_TESTS.filter((t) => t.status === "Active").length;
  const avgQ = Math.round(MOCK_TESTS.reduce((s, t) => s + t.questionCount, 0) / total);
  const candidates = MOCK_TESTS.reduce((s, t) => s + t.candidateCount, 0);

  const stats = [
    { label: "Total Tests", value: total, icon: ClipboardList, sub: "all time" },
    { label: "Active Tests", value: active, icon: Activity, sub: "currently live" },
    { label: "Avg Questions", value: avgQ, icon: Hash, sub: "per test" },
    { label: "Candidates Tested", value: candidates, icon: Users, sub: "total" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, sub }) => (
        <div
          key={label}
          className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
              <p className="text-3xl font-bold text-zinc-900 mt-1 tabular-nums">{value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
            </div>
            <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
              <Icon className="w-4 h-4 text-zinc-600" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}