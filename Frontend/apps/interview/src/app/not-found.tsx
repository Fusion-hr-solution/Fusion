import { Button } from "@repo/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <h2 className="text-4xl font-bold tracking-tight mb-2 text-zinc-900">404</h2>
      <p className="text-zinc-500 mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      {/* basePath /interview is added automatically — just use "/" */}
      <a href="/">
        <Button>Back to Tests</Button>
      </a>
    </div>
  );
}