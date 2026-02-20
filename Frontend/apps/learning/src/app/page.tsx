import { Input } from "@repo/ui";
import { CourseCard } from "@/components";
import { getCourses } from "@/services/learning-service";

export default async function LearningPage() {
  const courses = await getCourses();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Learning Center</h1>
        <p className="mt-2 text-muted-foreground">
          Explore courses, resources, and knowledge base materials.
        </p>
      </div>

      <div className="mb-8">
        <Input placeholder="Search courses..." className="max-w-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
