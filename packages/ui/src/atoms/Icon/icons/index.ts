import { BellIcon } from './bell';
import { BlockIcon } from './block';
import { BoxIcon } from './box';
import { CheckListIcon } from './check-list';
import { ChevronDownIcon } from './chevron-down';
import { ChevronLeftIcon } from './chevron-left';
import { ChevronRightIcon } from './chevron-right';
import { FlagTRIcon } from './flag-tr';
import { FlagUSIcon } from './flag-us';
import { GridIcon } from './grid';
import { InfoIcon } from './info';
import { LoaderIcon } from './loader';
import { LogOutIcon } from './log-out';
import { MapPinIcon } from './map-pin';
import { MenuIcon } from './menu';
import { MoonIcon } from './moon';
import { PlusIcon } from './plus';
import { SearchIcon } from './search';
import { SettingsIcon } from './settings';
import { ShoppingCartIcon } from './shopping-cart';
import { StoreIcon } from './store';
import { SunIcon } from './sun';
import { TableIcon } from './table';
import { TrashIcon } from './trash';
import { UserIcon } from './user';
import { ValidationIcon } from './validation';
import { XIcon } from './x';
import { ZorroIcon } from './zorro';

export { BellIcon } from './bell';
export { BlockIcon } from './block';
export { BoxIcon } from './box';
export { CheckListIcon } from './check-list';
export { ChevronDownIcon } from './chevron-down';
export { ChevronLeftIcon } from './chevron-left';
export { ChevronRightIcon } from './chevron-right';
export { FlagTRIcon } from './flag-tr';
export { FlagUSIcon } from './flag-us';
export { GridIcon } from './grid';
export { InfoIcon } from './info';
export { LoaderIcon } from './loader';
export { LogOutIcon } from './log-out';
export { MapPinIcon } from './map-pin';
export { MenuIcon } from './menu';
export { MoonIcon } from './moon';
export { PlusIcon } from './plus';
export { SearchIcon } from './search';
export { SettingsIcon } from './settings';
export { ShoppingCartIcon } from './shopping-cart';
export { StoreIcon } from './store';
export { SunIcon } from './sun';
export { TableIcon } from './table';
export { TrashIcon } from './trash';
export { UserIcon } from './user';
export { ValidationIcon } from './validation';
export { XIcon } from './x';
export { ZorroIcon } from './zorro';

export const iconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'chevron-down': ChevronDownIcon as any,
  'chevron-left': ChevronLeftIcon as any,
  'chevron-right': ChevronRightIcon as any,
  'shopping-cart': ShoppingCartIcon as any,
  bell: BellIcon as any,
  block: BlockIcon as any,
  box: BoxIcon as any,
  'check-list': CheckListIcon as any,
  'flag-tr': FlagTRIcon as any,
  'flag-us': FlagUSIcon as any,
  grid: GridIcon as any,
  info: InfoIcon as any,
  loader: LoaderIcon as any,
  'log-out': LogOutIcon as any,
  logo: ZorroIcon as any,
  'map-pin': MapPinIcon as any,
  menu: MenuIcon as any,
  moon: MoonIcon as any,
  plus: PlusIcon as any,
  search: SearchIcon as any,
  settings: SettingsIcon as any,
  store: StoreIcon as any,
  sun: SunIcon as any,
  table: TableIcon as any,
  trash: TrashIcon as any,
  user: UserIcon as any,
  validation: ValidationIcon as any,
  zorro: ZorroIcon as any,
  x: XIcon as any,
} as const;

export type IconName = keyof typeof iconMap;
