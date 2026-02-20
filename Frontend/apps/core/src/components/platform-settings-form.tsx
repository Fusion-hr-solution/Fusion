"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
} from "@repo/ui";

export function PlatformSettingsForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Platform Settings</CardTitle>
        <CardDescription>Configure core platform parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="app-name">Application Name</Label>
          <Input id="app-name" defaultValue="Frontend Platform" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="environment">Environment</Label>
          <Input id="environment" defaultValue="Production" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input id="version" defaultValue="1.0.0" readOnly />
        </div>
        <Button className="w-full">Save Settings</Button>
      </CardContent>
    </Card>
  );
}
