/**
 * Performance's icon set: Hugeicons (stroke-rounded), exposed under the names the app's components use,
 * so each glyph choice lives here once and can be tuned without touching call sites. Every export is a
 * drop-in for the Lucide component it replaced: same `className` sizing (`size-4` etc.), `aria-hidden`,
 * and `strokeWidth` props. Shared `@repo/ds` primitives still draw their own Lucide chrome.
 */
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { HugeiconsIcon, type HugeiconsProps, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowTurnBackwardIcon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  AttachmentIcon,
  Building03Icon,
  Building06Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarCheck01Icon,
  CalendarClockIcon,
  Cancel01Icon,
  ChartColumnBigIcon,
  ChartColumnIcon,
  ChartLineData01Icon,
  CheckmarkCircle02Icon,
  CircleDashedIcon,
  ClipboardListIcon,
  Clock01Icon,
  CompassIcon,
  CornerLeftUpIcon,
  DashboardSpeed02Icon,
  DashboardSquare01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  Edit02Icon,
  File02Icon,
  FileValidationIcon,
  FilterHorizontalIcon,
  Flag02Icon,
  FloppyDiskIcon,
  FlowConnectionIcon,
  GitBranchIcon,
  GoalIcon,
  HierarchyIcon,
  Home01Icon,
  Idea01Icon,
  InformationCircleIcon,
  Layers01Icon,
  Link02Icon,
  LinkSquare02Icon,
  Loading03Icon,
  Mail01Icon,
  Message01Icon,
  MilestoneIcon,
  MinusSignCircleIcon,
  MinusSignIcon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  PercentIcon,
  PieChart02Icon,
  PlayIcon,
  Progress02Icon,
  RefreshIcon,
  Rocket01Icon,
  Route02Icon,
  RulerIcon,
  Search01Icon,
  SentIcon,
  Settings02Icon,
  Share08Icon,
  ShieldCheckIcon,
  SigmaIcon,
  SlidersHorizontalIcon,
  SquareLock02Icon,
  Target02Icon,
  TaskDone01Icon,
  TextFontIcon,
  Tick02Icon,
  TradeDownIcon,
  TradeUpIcon,
  TriangleIcon,
  UnavailableIcon,
  UnfoldMoreIcon,
  Unlink02Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  UserMinus01Icon,
  UserRemove01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";

// `strokeWidth` also takes a string so these stay assignable wherever `@repo/ds` expects a Lucide icon.
export type IconProps = Omit<HugeiconsProps, "icon" | "ref" | "altIcon" | "showAlt" | "strokeWidth"> & {
  strokeWidth?: number | string;
};
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

/** Hugeicons' 1.5 default reads thin beside Geist at 14–16px; 1.75 keeps the rounded style but holds weight. */
const STROKE = 1.75;

function icon(svg: IconSvgElement, name: string): Icon {
  const Component = forwardRef<SVGSVGElement, IconProps>(function AppIcon({ strokeWidth = STROKE, ...props }, ref) {
    return <HugeiconsIcon ref={ref} icon={svg} strokeWidth={Number(strokeWidth)} {...props} />;
  });
  Component.displayName = name;
  return Component;
}

// Status and confirmation
export const Check = icon(Tick02Icon, "Check");
export const CheckIcon = Check;
export const CircleCheck = icon(CheckmarkCircle02Icon, "CircleCheck");
export const CheckCircle2 = CircleCheck;
export const X = icon(Cancel01Icon, "X");
export const Info = icon(InformationCircleIcon, "Info");
export const TriangleAlert = icon(Alert02Icon, "TriangleAlert");
export const AlertTriangle = TriangleAlert;
export const CircleAlert = icon(AlertCircleIcon, "CircleAlert");
export const AlertCircle = CircleAlert;
export const Ban = icon(UnavailableIcon, "Ban");
export const Lock = icon(SquareLock02Icon, "Lock");
export const ShieldCheck = icon(ShieldCheckIcon, "ShieldCheck");
export const CircleDashed = icon(CircleDashedIcon, "CircleDashed");
export const CircleMinus = icon(MinusSignCircleIcon, "CircleMinus");
export const Loader2 = icon(Loading03Icon, "Loader2");
export const LoaderCircle = Loader2;

// Navigation and direction
export const ChevronRight = icon(ArrowRight01Icon, "ChevronRight");
export const ChevronLeft = icon(ArrowLeft01Icon, "ChevronLeft");
export const ChevronDown = icon(ArrowDown01Icon, "ChevronDown");
export const ChevronUp = icon(ArrowUp01Icon, "ChevronUp");
export const ChevronsUpDown = icon(UnfoldMoreIcon, "ChevronsUpDown");
export const ArrowRight = icon(ArrowRight02Icon, "ArrowRight");
export const ArrowLeft = icon(ArrowLeft02Icon, "ArrowLeft");
export const ArrowUpRight = icon(ArrowUpRight01Icon, "ArrowUpRight");
export const ExternalLink = icon(LinkSquare02Icon, "ExternalLink");
export const CornerLeftUp = icon(CornerLeftUpIcon, "CornerLeftUp");
export const Home = icon(Home01Icon, "Home");
export const LayoutDashboard = icon(DashboardSquare01Icon, "LayoutDashboard");
export const Compass = icon(CompassIcon, "Compass");

// Actions
export const Plus = icon(Add01Icon, "Plus");
export const Minus = icon(MinusSignIcon, "Minus");
export const Trash2 = icon(Delete02Icon, "Trash2");
export const Pencil = icon(PencilEdit02Icon, "Pencil");
export const PencilLine = icon(PencilEdit01Icon, "PencilLine");
export const SquarePen = icon(Edit02Icon, "SquarePen");
export const Search = icon(Search01Icon, "Search");
export const Eye = icon(ViewIcon, "Eye");
export const RotateCcw = icon(ArrowTurnBackwardIcon, "RotateCcw");
export const RefreshCw = icon(RefreshIcon, "RefreshCw");
export const Save = icon(FloppyDiskIcon, "Save");
export const Send = icon(SentIcon, "Send");
export const FileCheck2 = icon(FileValidationIcon, "FileCheck2");
export const Play = icon(PlayIcon, "Play");
export const Rocket = icon(Rocket01Icon, "Rocket");
export const Share2 = icon(Share08Icon, "Share2");
export const Link2 = icon(Link02Icon, "Link2");
export const Unlink = icon(Unlink02Icon, "Unlink");
export const Paperclip = icon(AttachmentIcon, "Paperclip");
export const MoreHorizontal = icon(MoreHorizontalIcon, "MoreHorizontal");
export const GripVertical = icon(DragDropVerticalIcon, "GripVertical");
export const ListFilter = icon(FilterHorizontalIcon, "ListFilter");
export const SlidersHorizontal = icon(SlidersHorizontalIcon, "SlidersHorizontal");
export const Settings = icon(Settings02Icon, "Settings");

// People and organization
export const User = icon(UserIcon, "User");
export const UserRound = User;
export const CircleUserRound = icon(UserCircleIcon, "CircleUserRound");
export const Users = icon(UserGroupIcon, "Users");
export const Users2 = Users;
export const UsersRound = Users;
export const UserPlus = icon(UserAdd01Icon, "UserPlus");
export const UserMinus = icon(UserMinus01Icon, "UserMinus");
export const UserX = icon(UserRemove01Icon, "UserX");
export const UserRoundCheck = icon(UserCheck01Icon, "UserRoundCheck");
export const Building2 = icon(Building03Icon, "Building2");
export const Landmark = icon(Building06Icon, "Landmark");
export const Network = icon(HierarchyIcon, "Network");
export const GitBranch = icon(GitBranchIcon, "GitBranch");
export const Waypoints = icon(FlowConnectionIcon, "Waypoints");
export const Layers = icon(Layers01Icon, "Layers");

// Objectives, measurement and time
export const Target = icon(Target02Icon, "Target");
export const Gauge = icon(DashboardSpeed02Icon, "Gauge");
export const Flag = icon(Flag02Icon, "Flag");
export const Percent = icon(PercentIcon, "Percent");
export const Sigma = icon(SigmaIcon, "Sigma");
export const Triangle = icon(TriangleIcon, "Triangle");
export const Type = icon(TextFontIcon, "Type");
export const ListChecks = icon(TaskDone01Icon, "ListChecks");
export const ClipboardList = icon(ClipboardListIcon, "ClipboardList");
export const FileText = icon(File02Icon, "FileText");
export const Lightbulb = icon(Idea01Icon, "Lightbulb");
export const MessageSquare = icon(Message01Icon, "MessageSquare");
export const Mail = icon(Mail01Icon, "Mail");
export const TrendingUp = icon(TradeUpIcon, "TrendingUp");
export const TrendingDown = icon(TradeDownIcon, "TrendingDown");
export const LineChart = icon(ChartLineData01Icon, "LineChart");
export const BarChart3 = icon(ChartColumnIcon, "BarChart3");
export const ChartColumn = BarChart3;
export const ChartColumnBig = icon(ChartColumnBigIcon, "ChartColumnBig");
export const PieChart = icon(PieChart02Icon, "PieChart");
export const Clock = icon(Clock01Icon, "Clock");
export const CalendarDays = icon(Calendar03Icon, "CalendarDays");
export const CalendarRange = CalendarDays;
export const CalendarPlus = icon(CalendarAdd01Icon, "CalendarPlus");
export const CalendarClock = icon(CalendarClockIcon, "CalendarClock");
export const CalendarCheck = icon(CalendarCheck01Icon, "CalendarCheck");
export const Route = icon(Route02Icon, "Route");

// Objective facts: each measurement concept gets its own glyph rather than one generic "object" mark.
export const Measurement = icon(RulerIcon, "Measurement");
export const NumericGoal = icon(GoalIcon, "NumericGoal");
export const Milestones = icon(MilestoneIcon, "Milestones");
export const PercentMeasure = icon(Progress02Icon, "PercentMeasure");
