import { Button } from "@repo/ui";
import { MfeCard } from "@/components";
import { APP_NAME, APP_DESCRIPTION, MICROFRONTENDS } from "@/config/constants";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <section className="mb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          {APP_DESCRIPTION}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg">Get Started</Button>
          <Button variant="outline" size="lg">
            Documentation
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center">
          Microfrontend Applications
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {MICROFRONTENDS.map((mfe) => (
            <MfeCard key={mfe.title} mfe={mfe} />
          ))}
        </div>
      </section>
    </div>
  );
}
