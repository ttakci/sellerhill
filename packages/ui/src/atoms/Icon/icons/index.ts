import { AlertCircleIcon } from './alert-circle';
import { ArchiveIcon } from './archive';
import { BellIcon } from './bell';
import { CalendarIcon } from './calendar';
import { ChevronDownIcon } from './chevron-down';
import { ChevronLeftIcon } from './chevron-left';
import { ChevronRightIcon } from './chevron-right';
import { CopyIcon } from './copy';
import { EyeIcon } from './eye';
import { GlobeIcon } from './globe';
import { InboxIcon } from './inbox';
import { LinkIcon } from './link';
import { MailIcon } from './mail';
import { MenuIcon } from './menu';
import { MoonIcon } from './moon';
import { PhoneIcon } from './phone';
import { PlusIcon } from './plus';
import { SearchIcon } from './search';
import { SunIcon } from './sun';
import { TrashIcon } from './trash';
import { UploadIcon } from './upload';
import { UserIcon } from './user';

export { AlertCircleIcon } from './alert-circle';
export { ArchiveIcon } from './archive';
export { BellIcon } from './bell';
export { CalendarIcon } from './calendar';
export { ChevronDownIcon } from './chevron-down';
export { ChevronLeftIcon } from './chevron-left';
export { ChevronRightIcon } from './chevron-right';
export { CopyIcon } from './copy';
export { EyeIcon } from './eye';
export { GlobeIcon } from './globe';
export { InboxIcon } from './inbox';
export { LinkIcon } from './link';
export { MailIcon } from './mail';
export { MenuIcon } from './menu';
export { MoonIcon } from './moon';
export { PhoneIcon } from './phone';
export { PlusIcon } from './plus';
export { SearchIcon } from './search';
export { SunIcon } from './sun';
export { TrashIcon } from './trash';
export { UploadIcon } from './upload';
export { UserIcon } from './user';

export const iconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'alert-circle': AlertCircleIcon as any,
  inbox: InboxIcon as any,
  calendar: CalendarIcon as any,
  'chevron-right': ChevronRightIcon as any,
  'chevron-left': ChevronLeftIcon as any,
  trash: TrashIcon as any,
  archive: ArchiveIcon as any,
  moon: MoonIcon as any,
  sun: SunIcon as any,
  'chevron-down': ChevronDownIcon as any,
  eye: EyeIcon as any,
  mail: MailIcon as any,
  phone: PhoneIcon as any,
  copy: CopyIcon as any,
  search: SearchIcon as any,
  bell: BellIcon as any,
  upload: UploadIcon as any,
  link: LinkIcon as any,
  globe: GlobeIcon as any,
  user: UserIcon as any,
  menu: MenuIcon as any,
  plus: PlusIcon as any,
} as const;

export type IconName = keyof typeof iconMap;
