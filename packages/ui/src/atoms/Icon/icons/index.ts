import { AlertCircleIcon } from './alert-circle';
import { ArchiveIcon } from './archive';
import { CalendarIcon } from './calendar';
import { ChevronRightIcon } from './chevron-right';
import { InboxIcon } from './inbox';
import { MoonIcon } from './moon';
import { SunIcon } from './sun';
import { TrashIcon } from './trash';

export { AlertCircleIcon } from './alert-circle';
export { InboxIcon } from './inbox';
export { CalendarIcon } from './calendar';
export { ChevronRightIcon } from './chevron-right';
export { TrashIcon } from './trash';
export { ArchiveIcon } from './archive';
export { MoonIcon } from './moon';
export { SunIcon } from './sun';

export const iconMap = {
  'alert-circle': AlertCircleIcon,
  inbox: InboxIcon,
  calendar: CalendarIcon,
  'chevron-right': ChevronRightIcon,
  trash: TrashIcon,
  archive: ArchiveIcon,
  moon: MoonIcon,
  sun: SunIcon,
} as const;

export type IconName = keyof typeof iconMap;
