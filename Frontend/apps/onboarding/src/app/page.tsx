import { NewHireCard, StatCard } from "@/components";
import { getNewHires } from "@/services/onboarding-service";
import { APP_NAME, APP_DESCRIPTION } from "@/config/constants";

export default async function OnboardingPage() {
  const newHires = await getNewHires();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-2 text-muted-foreground">{APP_DESCRIPTION}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Active Onboardings" value="12" />
        <StatCard label="Completed This Month" value="5" />
        <StatCard label="Avg Completion Time" value="14 days" />
      </div>

      <h2 className="text-xl font-semibold mb-4">New Hire Progress</h2>
      <div className="space-y-4">
        {newHires.map((hire) => (
          <NewHireCard key={hire.id} hire={hire} />
        ))}
      </div>
    </div>
  );
}
