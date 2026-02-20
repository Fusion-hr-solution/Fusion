import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@repo/ui";
import { type PlatformModule } from "@/types";

const variantMap: Record<PlatformModule["status"], "default" | "secondary" | "outline"> = {
  active: "default",
  maintenance: "secondary",
  disabled: "outline",
};

const labelMap: Record<PlatformModule["status"], string> = {
  active: "Active",
  maintenance: "Maintenance",
  disabled: "Disabled",
};

interface ModuleCardProps {
  module: PlatformModule;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{module.title}</CardTitle>
          <Badge variant={variantMap[module.status]}>
            {labelMap[module.status]}
          </Badge>
        </div>
        <CardDescription>{module.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" variant="outline">
          Configure
        </Button>
      </CardContent>
    </Card>
  );
}
