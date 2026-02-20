import { InterviewCard, ScheduleInterviewForm } from "@/components";
import { getInterviews } from "@/services/interview-service";

export default async function InterviewPage() {
  const interviews = await getInterviews();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Interview Management</h1>
        <p className="mt-2 text-muted-foreground">
          Manage interview workflows, scheduling, and candidate assessments.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Upcoming Interviews</h2>
          <div className="space-y-4">
            {interviews.map((interview) => (
              <InterviewCard key={interview.id} interview={interview} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Schedule New</h2>
          <ScheduleInterviewForm />
        </div>
      </div>
    </div>
  );
}
