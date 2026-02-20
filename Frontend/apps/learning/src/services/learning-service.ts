import { type Course } from "@/types";

const MOCK_COURSES: Course[] = [
  {
    id: "1",
    title: "Introduction to TypeScript",
    description: "Learn the fundamentals of TypeScript and how to use it in real-world projects.",
    level: "beginner",
    duration: "4 hours",
    progress: 75,
  },
  {
    id: "2",
    title: "Advanced React Patterns",
    description: "Deep dive into advanced React patterns including compound components and render props.",
    level: "advanced",
    duration: "6 hours",
    progress: 30,
  },
  {
    id: "3",
    title: "Microfrontend Architecture",
    description: "Understanding microfrontend architecture patterns and best practices.",
    level: "intermediate",
    duration: "3 hours",
    progress: 0,
  },
  {
    id: "4",
    title: "Design Systems with Tailwind",
    description: "Building scalable design systems using Tailwind CSS and component libraries.",
    level: "intermediate",
    duration: "5 hours",
    progress: 100,
  },
];

export async function getCourses(): Promise<Course[]> {
  // TODO: Replace with actual API call
  return MOCK_COURSES;
}
