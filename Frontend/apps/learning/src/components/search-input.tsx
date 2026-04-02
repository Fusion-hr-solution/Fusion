import { Search } from "lucide-react";
import { Input } from "@repo/ui";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "Search",
}: SearchInputProps) {
  return (
    <div className="relative max-w-lg">
      <Search
        className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border-border/60 bg-muted/50 pl-10 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:ring-[hsl(var(--ey-yellow))] focus-visible:border-[hsl(var(--ey-yellow)/0.4)] transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(var(--ey-yellow)/0.1)]"
      />
    </div>
  );
}
