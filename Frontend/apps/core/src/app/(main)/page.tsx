import { ModuleCard, PlatformSettingsForm } from "@/components";
import { getPlatformModules } from "@/services/core-service";

export default async function CorePage() {
  const modules = await getPlatformModules();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Core Platform</h1>
        <p className="mt-2 text-muted-foreground">
          Core platform features, settings, and administration tools.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Platform Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Settings</h2>
          <PlatformSettingsForm />
        </div>
      </div>
    </div>
  );
}
