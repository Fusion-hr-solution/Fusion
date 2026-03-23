import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "@repo/ui";
import {
  Video,
  BrainCircuit,
  BookOpen,
  BarChart2,
  Users,
  Handshake,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  type LucideIcon,
} from "lucide-react";

/* ── Module card data ─────────────────────────────────────────────────── */

interface Module {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  stat: string;
  statLabel: string;
}

const MODULES: Module[] = [
  {
    title: "Core",
    description: "Platform settings, administration tools, and system configuration.",
    href: "/core",
    icon: BrainCircuit,
    color: "from-slate-600 to-slate-800",
    stat: "3",
    statLabel: "Active configs",
  },
  {
    title: "Learning",
    description: "Courses, certifications, and employee development programs.",
    href: "/learning",
    icon: BookOpen,
    color: "from-amber-500 to-amber-700",
    stat: "24",
    statLabel: "Active courses",
  },
  {
    title: "Performance",
    description: "Track reviews, goals, and development plans across the organization.",
    href: "/performance",
    icon: BarChart2,
    color: "from-emerald-500 to-emerald-700",
    stat: "128",
    statLabel: "Reviews this quarter",
  },
  {
    title: "Recruitment",
    description: "Manage job openings, applicant pipelines, and hiring workflows.",
    href: "/recruitment",
    icon: Users,
    color: "from-blue-500 to-blue-700",
    stat: "18",
    statLabel: "Open positions",
  },
  {
    title: "Onboarding",
    description: "Guide new hires through orientation, training, and team integration.",
    href: "/onboarding",
    icon: Handshake,
    color: "from-violet-500 to-violet-700",
    stat: "12",
    statLabel: "Active onboardings",
  },
  {
    title: "Interview",
    description: "Manage assessments, test creation, and candidate evaluations.",
    href: "/interview",
    icon: Video,
    color: "from-rose-500 to-rose-700",
    stat: "42",
    statLabel: "Tests managed",
  },
];

/* ── Quick stat card ──────────────────────────────────────────────────── */

function QuickStat({
  icon: Icon,
  value,
  label,
  trend,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span>{trend}</span>
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--ey-grey-100))]">
            <Icon className="h-5 w-5 text-[hsl(var(--ey-grey-400))]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Module card ──────────────────────────────────────────────────────── */

function ModuleCard({ module }: { module: Module }) {
  const Icon = module.icon;
  return (
    <Card className="group relative overflow-hidden transition-shadow duration-300 hover:shadow-lg">
      {/* Gradient accent strip */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${module.color}`}
      />
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${module.color} text-white shadow-sm`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{module.title}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {module.stat} {module.statLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <CardDescription className="text-sm leading-relaxed">
          {module.description}
        </CardDescription>
      </CardContent>
      <CardFooter className="pb-4">
        <a href={module.href} className="w-full">
          <Button
            variant="outline"
            className="w-full justify-between group-hover:border-[hsl(var(--ey-grey-300))] group-hover:bg-[hsl(var(--ey-grey-50))] transition-colors"
          >
            <span>Open {module.title}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--ey-grey-50))]">
      {/* Hero banner */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-[hsl(var(--ey-grey-500))] via-[hsl(var(--ey-black))] to-[hsl(var(--ey-grey-500))]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIj48cGF0aCBkPSJNMzYgMzRoLTJWMGgydjM0em0tNCAwaDJWMGgtMnYzNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="relative px-8 py-12">
          <div className="flex items-center gap-2 text-[hsl(var(--ey-yellow))]">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              EY Fusion Platform
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 max-w-xl text-base text-white/70">
            Your unified HR platform — manage talent, learning, performance, and
            more from a single workplace.
          </p>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8">
        {/* Quick stats row */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--ey-grey-400))]">
            <Clock className="h-4 w-4" />
            Platform Overview
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickStat icon={Users} value="1,247" label="Total Employees" trend="+3.2% this month" />
            <QuickStat icon={BookOpen} value="86" label="Active Courses" trend="+12 new" />
            <QuickStat icon={BarChart2} value="94%" label="Review Completion" trend="+2.1%" />
            <QuickStat icon={Handshake} value="12" label="Onboardings in Progress" />
          </div>
        </section>

        {/* Modules grid */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--ey-grey-400))]">
            Modules
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((mod) => (
              <ModuleCard key={mod.title} module={mod} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
