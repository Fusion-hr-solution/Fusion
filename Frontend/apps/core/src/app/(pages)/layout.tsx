import type { ReactNode } from "react";
import { AppBreadcrumb } from "@/components/app-breadcrumb";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <AppBreadcrumb />
      </header>
      {children}
    </div>
  );
}
