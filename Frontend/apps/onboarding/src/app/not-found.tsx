import { Button } from "@repo/ui";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-4xl font-bold tracking-tight mb-2">404</h2>
        <p className="text-muted-foreground mb-6">
          The page you&apos;re looking for doesn&apos;t exist in the Onboarding module.
        </p>
        <a href="/onboarding">
          <Button>Back to Onboarding</Button>
        </a>
      </div>
    </div>
  );
}
