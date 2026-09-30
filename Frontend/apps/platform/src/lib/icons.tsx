/**
 * Platform's icon set: Hugeicons (stroke-rounded), exposed under the names the app's components use,
 * so each glyph choice lives here once and can be tuned without touching call sites. Glyphs shared
 * with Performance map to the same Hugeicons so the two modules speak one visual language. Every
 * export is a drop-in for the Lucide component it replaced (`className` sizing, `aria-hidden`,
 * `strokeWidth`). Shared `@repo/ds` primitives still draw their own Lucide chrome.
 */
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { HugeiconsIcon, type HugeiconsProps, type IconSvgElement } from "@hugeicons/react";
import {
  Activity01Icon,
  Add01Icon,
  Agreement02Icon,
  AiBrain01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  ArrowTurnBackwardIcon,
  BookOpen01Icon,
  Building03Icon,
  Calendar03Icon,
  ChartColumnIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  DashboardSpeed02Icon,
  DashboardSquare02Icon,
  Download01Icon,
  File02Icon,
  FingerPrintIcon,
  Globe02Icon,
  GridViewIcon,
  HourglassIcon,
  Idea01Icon,
  InformationCircleIcon,
  LanguageSkillIcon,
  Layers01Icon,
  LinkSquare02Icon,
  Mail01Icon,
  MailRemove01Icon,
  MailValidation01Icon,
  MinusSignIcon,
  MoreHorizontalIcon,
  Note01Icon,
  PackageIcon,
  PencilEdit02Icon,
  PowerOffIcon,
  RefreshIcon,
  SearchRemoveIcon,
  SentIcon,
  Settings02Icon,
  Shield01Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SquareLock02Icon,
  Tick02Icon,
  UnavailableIcon,
  UnfoldMoreIcon,
  UserCheck01Icon,
  UserEdit01Icon,
  UserGroupIcon,
  UserIcon,
  Video01Icon,
  WorkHistoryIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";

// `strokeWidth` also takes a string so these stay assignable wherever `@repo/ds` expects a Lucide icon.
export type IconProps = Omit<HugeiconsProps, "icon" | "ref" | "altIcon" | "showAlt" | "strokeWidth"> & {
  strokeWidth?: number | string;
};
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
/** The name call sites used for an icon component type under Lucide. */
export type LucideIcon = Icon;

/** Hugeicons' 1.5 default reads thin beside Geist at 14–16px; 1.75 keeps the rounded style but holds weight. */
const STROKE = 1.75;

function icon(svg: IconSvgElement, name: string): Icon {
  const Component = forwardRef<SVGSVGElement, IconProps>(function AppIcon({ strokeWidth = STROKE, ...props }, ref) {
    return <HugeiconsIcon ref={ref} icon={svg} strokeWidth={Number(strokeWidth)} {...props} />;
  });
  Component.displayName = name;
  return Component;
}

export const Activity = icon(Activity01Icon, "Activity");
export const AlertCircle = icon(AlertCircleIcon, "AlertCircle");
export const AlertTriangle = icon(Alert02Icon, "AlertTriangle");
export const ArrowLeft = icon(ArrowLeft02Icon, "ArrowLeft");
export const ArrowRight = icon(ArrowRight02Icon, "ArrowRight");
export const Ban = icon(UnavailableIcon, "Ban");
export const BarChart3 = icon(ChartColumnIcon, "BarChart3");
export const Blocks = icon(DashboardSquare02Icon, "Blocks");
export const BookOpen = icon(BookOpen01Icon, "BookOpen");
export const Boxes = icon(PackageIcon, "Boxes");
export const BrainCircuit = icon(AiBrain01Icon, "BrainCircuit");
export const Building2 = icon(Building03Icon, "Building2");
export const CalendarDays = icon(Calendar03Icon, "CalendarDays");
export const Check = icon(Tick02Icon, "Check");
export const CheckCircle2 = icon(CheckmarkCircle02Icon, "CheckCircle2");
export const ChevronDown = icon(ArrowDown01Icon, "ChevronDown");
export const ChevronsUpDown = icon(UnfoldMoreIcon, "ChevronsUpDown");
export const CircleAlert = icon(AlertCircleIcon, "CircleAlert");
export const CircleCheck = icon(CheckmarkCircle02Icon, "CircleCheck");
export const CircleSlash = icon(UnavailableIcon, "CircleSlash");
export const Clock = icon(Clock01Icon, "Clock");
export const Copy = icon(Copy01Icon, "Copy");
export const Download = icon(Download01Icon, "Download");
export const ExternalLink = icon(LinkSquare02Icon, "ExternalLink");
export const FileText = icon(File02Icon, "FileText");
export const Fingerprint = icon(FingerPrintIcon, "Fingerprint");
export const Gauge = icon(DashboardSpeed02Icon, "Gauge");
export const Globe = icon(Globe02Icon, "Globe");
export const Handshake = icon(Agreement02Icon, "Handshake");
export const History = icon(WorkHistoryIcon, "History");
export const Hourglass = icon(HourglassIcon, "Hourglass");
export const Info = icon(InformationCircleIcon, "Info");
export const Languages = icon(LanguageSkillIcon, "Languages");
export const Layers = icon(Layers01Icon, "Layers");
export const LayoutGrid = icon(GridViewIcon, "LayoutGrid");
export const Lightbulb = icon(Idea01Icon, "Lightbulb");
export const Lock = icon(SquareLock02Icon, "Lock");
export const Mail = icon(Mail01Icon, "Mail");
export const MailCheck = icon(MailValidation01Icon, "MailCheck");
export const MailX = icon(MailRemove01Icon, "MailX");
export const Minus = icon(MinusSignIcon, "Minus");
export const MoreHorizontal = icon(MoreHorizontalIcon, "MoreHorizontal");
export const Pencil = icon(PencilEdit02Icon, "Pencil");
export const Plus = icon(Add01Icon, "Plus");
export const PowerOff = icon(PowerOffIcon, "PowerOff");
export const RefreshCw = icon(RefreshIcon, "RefreshCw");
export const RotateCcw = icon(ArrowTurnBackwardIcon, "RotateCcw");
export const ScrollText = icon(Note01Icon, "ScrollText");
export const SearchX = icon(SearchRemoveIcon, "SearchX");
export const Send = icon(SentIcon, "Send");
export const Settings2 = icon(Settings02Icon, "Settings2");
export const Shield = icon(Shield01Icon, "Shield");
export const ShieldAlert = icon(ShieldAlertIcon, "ShieldAlert");
export const ShieldCheck = icon(ShieldCheckIcon, "ShieldCheck");
export const SlidersHorizontal = icon(SlidersHorizontalIcon, "SlidersHorizontal");
export const TriangleAlert = icon(Alert02Icon, "TriangleAlert");
export const User = icon(UserIcon, "User");
export const UserCheck = icon(UserCheck01Icon, "UserCheck");
export const UserPen = icon(UserEdit01Icon, "UserPen");
export const UsersRound = icon(UserGroupIcon, "UsersRound");
export const Video = icon(Video01Icon, "Video");
export const Wrench = icon(Wrench01Icon, "Wrench");
