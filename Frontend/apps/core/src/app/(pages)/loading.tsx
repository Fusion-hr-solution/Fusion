import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function PagesLoading() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-sm">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Spinner />
          <span>Loading workspace...</span>
        </CardContent>
      </Card>
    </div>
  );
}
