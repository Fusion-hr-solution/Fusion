import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";

interface AdminExam {
  id: string;
  title: string;
  questionCount: number;
  passingScore: number;
}

interface AdminExamListProps {
  exams: AdminExam[];
}

export function AdminExamList({ exams }: AdminExamListProps) {
  if (exams.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Exams</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {exams.map((exam) => (
            <div key={exam.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <span className="text-sm font-medium text-foreground">{exam.title}</span>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{exam.questionCount} questions</span>
                <span>Pass: {exam.passingScore}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
