import { JobOpeningCard, StatCard } from "@/components";
import { getJobOpenings } from "@/services/recruitment-service";

export default async function RecruitmentPage() {
  const openings = await getJobOpenings();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Recruitment</h1>
        <p className="mt-2 text-muted-foreground">
          Manage job openings, track applicant pipelines, and streamline hiring.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard label="Open Positions" value="18" />
        <StatCard label="Total Applicants" value="312" />
        <StatCard label="In Pipeline" value="67" />
        <StatCard label="Offers Sent" value="8" />
      </div>

      <h2 className="text-xl font-semibold mb-4">Active Job Openings</h2>
      <div className="space-y-4">
        {openings.map((opening) => (
          <JobOpeningCard key={opening.id} opening={opening} />
        ))}
      </div>
    </div>
  );
}
