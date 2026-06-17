interface PageHeaderProps {
  moduleTitle: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageHeader({
  moduleTitle,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/50 bg-card">
      <div className="ey-hero-pattern absolute inset-0 opacity-30" />
      <div className="absolute right-0 top-0 h-full w-2/5 bg-gradient-to-l from-[hsl(var(--ey-yellow))]/5 to-transparent" />

      <div className="relative px-8 py-10 lg:py-12">
        <div className="ey-animate-fade-up flex items-end gap-3 mb-1">
          <div className="flex h-9 w-1 rounded-full ey-bg-accent" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {moduleTitle}
          </span>
        </div>

        <h1
          className="ey-animate-fade-up mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl"
          style={{ animationDelay: "80ms" }}
        >
          {title}
        </h1>
        <p
          className="ey-animate-fade-up mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground"
          style={{ animationDelay: "160ms" }}
        >
          {description}
        </p>

        {children}
      </div>
    </section>
  );
}
