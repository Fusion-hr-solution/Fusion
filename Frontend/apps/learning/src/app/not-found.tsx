import { Button } from "@repo/ui";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("appShell.notFound");
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="ey-animate-scale-in flex flex-col items-center">
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[hsl(var(--ey-grey-100))]">
            <GraduationCap className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          </div>
          <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full ey-bg-accent text-sm font-bold text-[hsl(var(--ey-grey-500))]">
            ?
          </div>
        </div>
        <h2 className="text-4xl font-bold tracking-tight text-foreground mb-2">
          404
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
          {t("message")}
        </p>
        <a href="/learning">
          <Button className="ey-bg-dark hover:ey-bg-dark-deep text-white gap-2 shadow-md hover:shadow-lg transition-all">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("backToLearning")}
          </Button>
        </a>
      </div>
    </div>
  );
}
