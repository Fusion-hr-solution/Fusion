import { CheckCircle2 } from "lucide-react";
import type { ExamInfo } from "@/types";
import { ExamCard } from "../exam-card";

interface ExamSectionProps {
  exam?: ExamInfo;
  chaptersCount: number;
}

export function ExamSection({ exam, chaptersCount }: ExamSectionProps) {
  return (
    <section
      className="ey-animate-fade-up"
      style={{ animationDelay: "300ms" }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <CheckCircle2
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          Final Assessment
        </h2>
      </div>

      {exam ? (
        <ExamCard exam={exam} chaptersCount={chaptersCount} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No exam required for this training. Complete all chapters to
            earn your certificate.
          </p>
        </div>
      )}
    </section>
  );
}
