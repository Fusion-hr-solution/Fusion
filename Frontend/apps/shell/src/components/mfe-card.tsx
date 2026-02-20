import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from "@repo/ui";
import { type Microfrontend } from "@/types";

interface MfeCardProps {
  mfe: Microfrontend;
}

export function MfeCard({ mfe }: MfeCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{mfe.title}</CardTitle>
          <Badge variant="secondary">{mfe.badge}</Badge>
        </div>
        <CardDescription>{mfe.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter>
        <a href={mfe.href} className="w-full">
          <Button className="w-full" variant="outline">
            Open {mfe.title}
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
}
