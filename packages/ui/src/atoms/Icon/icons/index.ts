import { AlertCircleIcon } from './alert-circle';
import { ArchiveIcon } from './archive';
import { BellIcon } from './bell';
import { BlockIcon } from './block';
import { BoxIcon } from './box';
import { CalendarIcon } from './calendar';
import { CameraIcon } from './camera';
import { CheckIcon } from './check';
import { CheckListIcon } from './check-list';
import { ChevronDownIcon } from './chevron-down';
import { ChevronLeftIcon } from './chevron-left';
import { ChevronRightIcon } from './chevron-right';
import { CodeIcon } from './code';
import { CopyIcon } from './copy';
import { EditIcon } from './edit';
import { ExternalLinkIcon } from './external-link';
import { EyeIcon } from './eye';
import { FacebookIcon } from './facebook';
import { FlagTRIcon } from './flag-tr';
import { FlagUSIcon } from './flag-us';
import { GlobeIcon } from './globe';
import { GoogleIcon } from './google';
import { GridIcon } from './grid';
import { InboxIcon } from './inbox';
import { InfoIcon } from './info';
import { LinkIcon } from './link';
import { LoaderIcon } from './loader';
import { LockIcon } from './lock';
import { LogOutIcon } from './log-out';
import { MailIcon } from './mail';
import { MapPinIcon } from './map-pin';
import { MenuIcon } from './menu';
import { MonitorIcon } from './monitor';
import { MoonIcon } from './moon';
import { PercentIcon } from './percent';
import { PhoneIcon } from './phone';
import { PlusIcon } from './plus';
import { SearchIcon } from './search';
import { SettingsIcon } from './settings';
import { ShoppingCartIcon } from './shopping-cart';
import { SmartphoneIcon } from './smartphone';
import { StoreIcon } from './store';
import { SunIcon } from './sun';
import { TableIcon } from './table';
import { TabletIcon } from './tablet';
import { TagIcon } from './tag';
import { TrashIcon } from './trash';
import { TrendingUpIcon } from './trending-up';
import { TwitterIcon } from './twitter';
import { UploadIcon } from './upload';
import { UserIcon } from './user';
import { ValidationIcon } from './validation';
import { XIcon } from './x';
import { ZorroIcon } from './zorro';

export { AlertCircleIcon } from './alert-circle';
export { ArchiveIcon } from './archive';
export { BellIcon } from './bell';
export { BlockIcon } from './block';
export { BoxIcon } from './box';
export { CalendarIcon } from './calendar';
export { CameraIcon } from './camera';
export { CheckIcon } from './check';
export { CheckListIcon } from './check-list';
export { ChevronDownIcon } from './chevron-down';
export { ChevronLeftIcon } from './chevron-left';
export { ChevronRightIcon } from './chevron-right';
export { CodeIcon } from './code';
export { CopyIcon } from './copy';
export { EditIcon } from './edit';
export { ExternalLinkIcon } from './external-link';
export { EyeIcon } from './eye';
export { FlagTRIcon } from './flag-tr';
export { FlagUSIcon } from './flag-us';
export { GlobeIcon } from './globe';
export { GoogleIcon } from './google';
export { GridIcon } from './grid';
export { InboxIcon } from './inbox';
export { InfoIcon } from './info';
export { LinkIcon } from './link';
export { LoaderIcon } from './loader';
export { LockIcon } from './lock';
export { LogOutIcon } from './log-out';
export { MailIcon } from './mail';
export { MapPinIcon } from './map-pin';
export { MenuIcon } from './menu';
export { MonitorIcon } from './monitor';
export { MoonIcon } from './moon';
export { PercentIcon } from './percent';
export { PhoneIcon } from './phone';
export { PlusIcon } from './plus';
export { SearchIcon } from './search';
export { SettingsIcon } from './settings';
export { ShoppingCartIcon } from './shopping-cart';
export { SmartphoneIcon } from './smartphone';
export { StoreIcon } from './store';
export { SunIcon } from './sun';
export { TableIcon } from './table';
export { TabletIcon } from './tablet';
export { TagIcon } from './tag';
export { TrashIcon } from './trash';
export { TrendingUpIcon } from './trending-up';
export { TwitterIcon } from './twitter';
export { UploadIcon } from './upload';
export { UserIcon } from './user';
export { ValidationIcon } from './validation';
export { XIcon } from './x';
export { ZorroIcon } from './zorro';

export const iconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'alert-circle': AlertCircleIcon as any,
  archive: ArchiveIcon as any,
  bell: BellIcon as any,
  block: BlockIcon as any,
  box: BoxIcon as any,
  calendar: CalendarIcon as any,
  check: CheckIcon as any,
  'check-list': CheckListIcon as any,
  camera: CameraIcon as any,
  'chevron-down': ChevronDownIcon as any,
  'chevron-left': ChevronLeftIcon as any,
  'chevron-right': ChevronRightIcon as any,
  code: CodeIcon as any,
  copy: CopyIcon as any,
  edit: EditIcon as any,
  facebook: FacebookIcon as any,
  eye: EyeIcon as any,
  'flag-tr': FlagTRIcon as any,
  'flag-us': FlagUSIcon as any,
  globe: GlobeIcon as any,
  google: GoogleIcon as any,
  grid: GridIcon as any,
  inbox: InboxIcon as any,
  info: InfoIcon as any,
  link: LinkIcon as any,
  loader: LoaderIcon as any,
  'log-out': LogOutIcon as any,
  logo: ZorroIcon as any,
  lock: LockIcon as any,
  mail: MailIcon as any,
  'map-pin': MapPinIcon as any,
  menu: MenuIcon as any,
  moon: MoonIcon as any,
  phone: PhoneIcon as any,
  plus: PlusIcon as any,
  search: SearchIcon as any,
  settings: SettingsIcon as any,
  'shopping-cart': ShoppingCartIcon as any,
  store: StoreIcon as any,
  sun: SunIcon as any,
  table: TableIcon as any,
  tag: TagIcon as any,
  trash: TrashIcon as any,
  twitter: TwitterIcon as any,
  'trending-up': TrendingUpIcon as any,
  upload: UploadIcon as any,
  user: UserIcon as any,
  validation: ValidationIcon as any,
  x: XIcon as any,
  zorro: ZorroIcon as any,
  monitor: MonitorIcon as any,
  tablet: TabletIcon as any,
  smartphone: SmartphoneIcon as any,
  percent: PercentIcon as any,
  'external-link': ExternalLinkIcon as any,
} as const;

export type IconName = keyof typeof iconMap;
