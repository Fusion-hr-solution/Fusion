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

// ── Utilities ────────────────────────────────────────────────────────
export { cn } from "./lib/utils";
