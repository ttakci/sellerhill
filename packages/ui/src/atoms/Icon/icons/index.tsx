/**
 * Icon mapping: our semantic names → Lucide React icons.
 *
 * Conventions (deliberate — each one fixes a real defect):
 *  1. **kebab-case only.** The Material-era `snake_case` twins (`open_in_new`,
 *     `keyboard_arrow_down`, …) were fossils from a previous icon set. 35 of
 *     them existed; 32 were never referenced. One name per concept now.
 *  2. **One glyph per meaning.** An alias is only justified when the names are
 *     true synonyms in our domain (`delete`/`trash`, `sync`/`refresh`).
 *     Aliasing *distinct* concepts onto one glyph is what made the UI read as
 *     "the same five icons everywhere" — `zap` used to draw Sparkles and
 *     `history` used to draw the refresh arrows.
 *  3. **Reach for a new import before reusing a near-miss.** Lucide ships
 *     ~1900 glyphs and we use a fraction of them; adding one here is cheap and
 *     is the intended way to grow the vocabulary.
 *  4. **`satisfies`, not `: Record<string, …>`.** The annotation widened
 *     `IconName` to `string`, so every icon name was unchecked and a typo only
 *     surfaced as a runtime `console.warn`. `satisfies` keeps the literal keys
 *     so `IconName` is a real union.
 *
 * Only the Google and Zorro brand marks are custom SVGs.
 */
import {
  type LucideIcon,
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  Ban,
  Banknote,
  BarChart3,
  Barcode,
  Bell,
  BellRing,
  Bolt,
  Bot,
  Box,
  Boxes,
  Building2,
  Calendar,
  CalendarDays,
  Camera,
  ChartLine,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Code,
  Coins,
  Copy,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Gauge,
  Globe,
  Headset,
  History,
  Home,
  Image,
  Inbox,
  Info,
  Key,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LifeBuoy,
  Link2,
  List,
  ListChecks,
  ListFilter,
  Loader2,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Package,
  PackageCheck,
  PackageOpen,
  PackageX,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Percent,
  Phone,
  PiggyBank,
  Play,
  Plug,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ReceiptText,
  RefreshCw,
  Repeat,
  Rocket,
  RotateCcw,
  Save,
  ScanBarcode,
  Search,
  Send,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SquarePen,
  Star,
  Store,
  Sun,
  Table,
  Tablet,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Undo2,
  UnfoldVertical,
  Upload,
  User,
  UserCog,
  Users,
  Wallet,
  WalletCards,
  Warehouse,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';

import { GoogleIcon } from './google';
import { TriangleInfoIcon } from './triangle-info';
import { ZorroIcon } from './zorro';

type IconGlyph = React.FC<React.SVGProps<SVGSVGElement>>;

const lucide = (IconComp: LucideIcon): IconGlyph => {
  const Wrapped = (props: React.SVGProps<SVGSVGElement>) => {
    const { stroke, strokeWidth, fill } = props;
    return React.createElement(IconComp, {
      size: 24,
      color: stroke as string,
      strokeWidth: Number(strokeWidth) || 2,
      // Lucide glyphs are stroke-drawn; `none` keeps them outlined unless a
      // caller explicitly asks for the solid variant via <Icon filled>.
      fill: (fill as string) ?? 'none',
    });
  };
  Wrapped.displayName = `LucideIcon(${IconComp.displayName || IconComp.name || 'Unknown'})`;
  return Wrapped;
};

export const iconMap = {
  // ── Navigation & shell ───────────────────────────────
  dashboard: lucide(LayoutDashboard),
  home: lucide(Home),
  storefront: lucide(Store),
  inbox: lucide(Inbox),
  settings: lucide(Settings),
  'settings-suggest': lucide(Settings2),
  menu: lucide(Menu),
  'panel-left': lucide(PanelLeft),
  'panel-left-close': lucide(PanelLeftClose),
  'panel-left-open': lucide(PanelLeftOpen),
  'log-out': lucide(LogOut),

  // ── Chevrons & arrows ────────────────────────────────
  'chevron-down': lucide(ChevronDown),
  'chevron-up': lucide(ChevronUp),
  'chevron-left': lucide(ChevronLeft),
  'chevron-right': lucide(ChevronRight),
  'arrow-left': lucide(ArrowLeft),
  'arrow-right': lucide(ArrowRight),
  'arrow-up-right': lucide(ArrowUpRight),
  'arrow-down-right': lucide(ArrowDownRight),
  'arrow-up-down': lucide(ArrowUpDown),
  'unfold-more': lucide(UnfoldVertical),

  // ── Catalog & inventory ──────────────────────────────
  /** One product / stock on hand */
  inventory: lucide(Package),
  /** Many units / bulk listings — deliberately distinct from `inventory` */
  'inventory-2': lucide(Boxes),
  box: lucide(Box),
  archive: lucide(Archive),
  /** Amazon source / fulfillment centre */
  warehouse: lucide(Warehouse),
  /** Draft listing — prepared but not published */
  'package-open': lucide(PackageOpen),
  /** Fulfilled / successfully placed */
  'package-check': lucide(PackageCheck),
  /** Out of stock / delisted ASIN */
  'package-x': lucide(PackageX),
  /** ASIN / UPC / EAN identifiers */
  barcode: lucide(Barcode),
  'scan-barcode': lucide(ScanBarcode),
  'qr-code': lucide(QrCode),
  tag: lucide(Tag),

  // ── Orders & shipping ────────────────────────────────
  'shopping-cart': lucide(ShoppingCart),
  'shopping-bag': lucide(ShoppingBag),
  receipt: lucide(Receipt),
  'receipt-text': lucide(ReceiptText),
  truck: lucide(Truck),
  'local-shipping': lucide(Truck),
  /** Refund / return */
  'undo-2': lucide(Undo2),
  'assignment-return': lucide(RotateCcw),

  // ── Money & billing ──────────────────────────────────
  payments: lucide(CreditCard),
  'account-balance-wallet': lucide(Wallet),
  'wallet-cards': lucide(WalletCards),
  /** Payout / seller earnings */
  banknote: lucide(Banknote),
  /** Cost of goods */
  coins: lucide(Coins),
  /** Retained margin */
  'piggy-bank': lucide(PiggyBank),
  'circle-dollar-sign': lucide(CircleDollarSign),
  'badge-percent': lucide(BadgePercent),
  percent: lucide(Percent),

  // ── Analytics ────────────────────────────────────────
  'bar-chart': lucide(BarChart3),
  /** Trend over time — was an exact duplicate of `bar-chart` */
  insights: lucide(ChartLine),
  'chart-line': lucide(ChartLine),
  activity: lucide(Activity),
  'trending-up': lucide(TrendingUp),
  'trending-down': lucide(TrendingDown),
  gauge: lucide(Gauge),

  // ── Automation & platform ops ────────────────────────
  bolt: lucide(Bolt),
  /** Was drawing Sparkles — now the actual lightning bolt */
  zap: lucide(Zap),
  sparkles: lucide(Sparkles),
  /** AI assistant / automated agent */
  bot: lucide(Bot),
  repeat: lucide(Repeat),
  sync: lucide(RefreshCw),
  refresh: lucide(RefreshCw),
  /** Past events — was drawing the refresh arrows */
  history: lucide(History),
  server: lucide(Server),
  database: lucide(Database),
  /** Integration / connected account */
  plug: lucide(Plug),
  webhook: lucide(Webhook),
  'clipboard-list': lucide(ClipboardList),
  'clipboard-check': lucide(ClipboardCheck),

  // ── Actions ──────────────────────────────────────────
  plus: lucide(Plus),
  minus: lucide(Minus),
  x: lucide(X),
  edit: lucide(Pencil),
  /** Edit rich content — a distinct pen from plain `edit` */
  'edit-note': lucide(SquarePen),
  delete: lucide(Trash2),
  trash: lucide(Trash2),
  copy: lucide(Copy),
  save: lucide(Save),
  download: lucide(Download),
  'file-download': lucide(Download),
  upload: lucide(Upload),
  'external-link': lucide(ExternalLink),
  'open-in-new': lucide(ExternalLink),
  link: lucide(Link2),
  search: lucide(Search),
  filter: lucide(Filter),
  'filter-list': lucide(ListFilter),
  'sliders-horizontal': lucide(SlidersHorizontal),
  eye: lucide(Eye),
  'eye-off': lucide(EyeOff),
  'play-arrow': lucide(Play),
  block: lucide(Ban),
  print: lucide(Printer),
  code: lucide(Code),
  send: lucide(Send),

  // ── Status & feedback ────────────────────────────────
  check: lucide(Check),
  'check-circle': lucide(CheckCircle),
  'check-list': lucide(ListChecks),
  'alert-circle': lucide(AlertCircle),
  'alert-triangle': lucide(AlertTriangle),
  'triangle-info': TriangleInfoIcon,
  /**
   * A crossed circle: "closed / removed / cancelled".
   *
   * No longer the error glyph for Toast / Dialog — those use `triangle-info`,
   * the same triangle-and-exclamation `ValidationMessage` shows under a field,
   * so a failure looks the same wherever it surfaces.
   */
  'x-circle': lucide(CircleX),
  info: lucide(Info),
  /** A genuine question mark — was drawing the Info circle */
  help: lucide(CircleHelp),
  loader: lucide(Loader2),
  bell: lucide(Bell),
  'bell-ring': lucide(BellRing),
  validation: lucide(BadgeCheck),

  // ── Security & accounts ──────────────────────────────
  lock: lucide(Lock),
  'lock-keyhole': lucide(LockKeyhole),
  key: lucide(Key),
  'key-round': lucide(KeyRound),
  shield: lucide(Shield),
  'shield-check': lucide(ShieldCheck),
  'shield-alert': lucide(ShieldAlert),
  user: lucide(User),
  /** Operator / role management */
  'user-cog': lucide(UserCog),
  users: lucide(Users),
  'building-2': lucide(Building2),

  // ── Support & messaging ──────────────────────────────
  mail: lucide(Mail),
  'message-circle': lucide(MessageCircle),
  /** Support agent */
  headset: lucide(Headset),
  'life-buoy': lucide(LifeBuoy),
  /** Buyer broadcast / announcements */
  megaphone: lucide(Megaphone),
  phone: lucide(Phone),
  globe: lucide(Globe),
  'map-pin': lucide(MapPin),

  // ── Theme ────────────────────────────────────────────
  sun: lucide(Sun),
  moon: lucide(Moon),

  // ── Content & media ──────────────────────────────────
  image: lucide(Image),
  camera: lucide(Camera),
  calendar: lucide(Calendar),
  'calendar-today': lucide(CalendarDays),
  clock: lucide(Clock),
  layers: lucide(Layers),
  star: lucide(Star),
  /** A real table grid — was drawing a document */
  table: lucide(Table),
  'file-text': lucide(FileText),

  // ── View toggles ─────────────────────────────────────
  'grid-view': lucide(LayoutGrid),
  list: lucide(List),
  'view-list': lucide(List),
  'list-alt': lucide(LayoutList),
  'format-list-bulleted': lucide(List),

  // ── Devices ──────────────────────────────────────────
  monitor: lucide(Monitor),
  tablet: lucide(Tablet),
  smartphone: lucide(Smartphone),

  // ── Overflow ─────────────────────────────────────────
  'more-horiz': lucide(MoreHorizontal),
  'more-vert': lucide(MoreVertical),

  // ── Misc ─────────────────────────────────────────────
  rocket: lucide(Rocket),

  // ── Brand (custom SVGs) ──────────────────────────────
  logo: ZorroIcon as IconGlyph,
  zorro: ZorroIcon as IconGlyph,
  google: GoogleIcon as IconGlyph,
  'brand-google': GoogleIcon as IconGlyph,
} satisfies Record<string, IconGlyph>;
