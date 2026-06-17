// ── shadcn primitives ────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from "./components/primitives/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/primitives/card";
export { Input } from "./components/primitives/input";
export { Label } from "./components/primitives/label";
export { Badge } from "./components/primitives/badge";
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./components/primitives/breadcrumb";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/primitives/dialog";
export { Progress } from "./components/primitives/progress";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/primitives/tooltip";
export { Avatar, AvatarImage, AvatarFallback } from "./components/primitives/avatar";
export { Separator } from "./components/primitives/separator";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/primitives/table";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/primitives/select";
export { Skeleton } from "./components/primitives/skeleton";
export { Checkbox } from "./components/primitives/checkbox";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/primitives/dropdown-menu";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/primitives/popover";
export { Calendar } from "./components/primitives/calendar";
export {
  DateTimePicker,
  type DateTimePickerProps,
} from "./components/primitives/date-time-picker";

// ── Custom EY components ─────────────────────────────────────────────
export {
  AppSidebar,
  ModuleSwitcher,
  SidebarNav,
  type NavItem,
  type NavSection,
  type SidebarModule,
  type AppSidebarProps,
} from "./components/sidebar";
export { TopLoader } from "./components/top-loader";
export { ModuleLayout } from "./components/module-layout";

// ── Theme (dark mode) ────────────────────────────────────────────────
export { ThemeProvider, useTheme } from "./components/theme/theme-provider";
export { ThemeScript } from "./components/theme/theme-script";
export {
  ThemeToggle,
  type ThemeToggleLabels,
} from "./components/theme/theme-toggle";
export type { Theme, ResolvedTheme } from "./components/theme/constants";
export { EmptyState } from "./components/feedback/empty-state";
export { ErrorState } from "./components/feedback/error-state";

// ── Utilities ────────────────────────────────────────────────────────
export { cn } from "./lib/utils";

// ── Table configuration ──────────────────────────────────────────────
export {
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE,
  SEARCH_DEBOUNCE_MS,
  parsePaginationFromParams,
  parseSortFromParams,
  type PageSize,
  type SortDirection,
  type TablePaginationConfig,
  type TableSortConfig,
} from "./lib/table-config";
