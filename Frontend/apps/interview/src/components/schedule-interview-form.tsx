"use client";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
} from "@repo/ui";

export function ScheduleInterviewForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New Interview</CardTitle>
        <CardDescription>Schedule a new interview session</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="candidate">Candidate Name</Label>
          <Input id="candidate" placeholder="Enter candidate name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input id="role" placeholder="Enter role" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Schedule Interview</Button>
      </CardFooter>
    </Card>
  );
}
