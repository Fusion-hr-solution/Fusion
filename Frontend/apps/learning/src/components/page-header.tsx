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
    <section className="border-b border-border/60 bg-background">
      <div className="px-8 py-6 lg:py-8">
        <p className="text-xs font-medium text-muted-foreground">{moduleTitle}</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground text-balance">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
        {children}
      </div>
    </section>
  );
}
