// Theme exports
export type { AppTheme, ThemeColors, ThemeMode } from './theme/theme.types';
export { darkTheme, lightTheme } from './theme/themes';
export { tkn } from './theme/tkn';
export { SIDEBAR_MOBILE_BREAKPOINT_PX } from './theme/designTokens';

// Atom exports
export { Button } from './atoms/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './atoms/Button';

export { IconButton } from './atoms/IconButton';
export type { IconButtonProps, IconButtonVariant } from './atoms/IconButton';

export { Checkbox } from './atoms/Checkbox';
export type { CheckboxProps } from './atoms/Checkbox';

export { Toggle } from './atoms/Toggle';
export type { ToggleProps } from './atoms/Toggle';

export { Textarea } from './atoms/Textarea';
export type { TextareaProps } from './atoms/Textarea';

export { Text } from './atoms/Text';
export type { TextAlign, TextElement, TextProps, TextVariant, TextWeight } from './atoms/Text';

export { Icon } from './atoms/Icon';
export type { IconName, IconProps, IconSize } from './atoms/Icon';
export { InfoMessage } from './atoms/InfoMessage';
export type { InfoMessageProps } from './atoms/InfoMessage';
export { Logo } from './atoms/Logo';
export { MeshBackground } from './atoms/MeshBackground';
export { Typewriter } from './atoms/Typewriter';

export { Card, CardBody, CardFooter, CardHeader, CardStat } from './atoms/Card';
export type {
  CardBodyProps,
  CardFooterProps,
  CardHeaderProps,
  CardPadding,
  CardProps,
  CardStatProps,
  CardVariant,
} from './atoms/Card';

export { Badge } from './atoms/Badge';
export type { BadgeProps, BadgeSize, BadgeVariant } from './atoms/Badge';

export { Skeleton } from './atoms/Skeleton';
export type { SkeletonProps, SkeletonRadius } from './atoms/Skeleton';

export { Breadcrumb } from './atoms/Breadcrumb';
export type { BreadcrumbItem, BreadcrumbProps } from './atoms/Breadcrumb';

export { Modal } from './atoms/Modal';
export type { ModalProps } from './atoms/Modal';

export { Dropdown } from './atoms/Dropdown';
export type { DropdownItem, DropdownProps } from './atoms/Dropdown';

export { Tabs } from './atoms/Tabs';
export type { TabItem, TabsProps } from './atoms/Tabs';
export { TabNav } from './atoms/TabNav';
export type { TabNavItem, TabNavProps } from './atoms/TabNav';

export { ProgressBar } from './atoms/ProgressBar';
export type { ProgressBarProps } from './atoms/ProgressBar';
export { ProgressRing } from './atoms/ProgressRing';
export type { ProgressRingProps } from './atoms/ProgressRing';

// Molecule exports
export { Select } from './molecules/Select';
export type { SelectOption, SelectProps, SelectSize } from './molecules/Select';

export { FilePicker } from './molecules/FilePicker';
export type { FilePickerProps } from './molecules/FilePicker';

export { TextInput } from './molecules/TextInput';
export type { TextInputProps, TextInputSize } from './molecules/TextInput';

export { ValidationMessage } from './molecules/ValidationMessage';
export type { ValidationMessageProps } from './molecules/ValidationMessage';

// Backward-compatible aliases (deprecated - will be removed)
export { Select as ModernSelect } from './molecules/Select';
export type { SelectOption as ModernSelectOption, SelectProps as ModernSelectProps } from './molecules/Select';
export { TextInput as ModernTextInput } from './molecules/TextInput';
export type { TextInputProps as ModernTextInputProps } from './molecules/TextInput';

export { ConfirmModal } from './molecules/ConfirmModal';
export type { ConfirmModalProps } from './molecules/ConfirmModal';

export { DEFAULT_DIALOG_TYPE_TITLES, Dialog } from './molecules/Dialog';
export type { DialogAction, DialogProps } from './molecules/Dialog';

export { Drawer } from './molecules/Drawer';
export type { DrawerProps, DrawerSize } from './molecules/Drawer';

export { MessageModal } from './molecules/MessageModal/index';
export type { MessageModalProps } from './molecules/MessageModal/index';

export { Table } from './molecules/Table';
export type { BulkAction, TableColumn, TableProps } from './molecules/Table';
export { TablePagination } from './molecules/Table/TablePagination.component';
export type {
  TablePaginationProps,
  TablePaginationVariant,
} from './molecules/Table/TablePagination.types';

export { SettingsCard } from './molecules/SettingsCard';
export type { SettingsCardHeaderProps, SettingsCardProps, SettingsCardVariant } from './molecules/SettingsCard';

export { SettingsActionRow } from './molecules/SettingsActionRow';
export type { SettingsActionRowProps, SettingsActionRowVariant } from './molecules/SettingsActionRow';

export { SettingsInfoRow } from './molecules/SettingsInfoRow';
export type { SettingsInfoRowProps } from './molecules/SettingsInfoRow';

export { StatusBadge } from './molecules/StatusBadge';
export type { StatusBadgeProps, StatusSize, StatusType } from './molecules/StatusBadge';

export { ToggleButton, ViewLabel, ViewToggle, ViewToggleGroup } from './molecules/ViewToggle';
export type { ViewMode, ViewToggleProps } from './molecules/ViewToggle';

export { PageHeader } from './molecules/PageHeader';
export type { PageHeaderProps } from './molecules/PageHeader';

/** Standard AppLayout page shells — no outer padding (gutter from ContentInner) */
export { PageContainer, PageContainerWithMobileBar } from './styles/pageLayout.style';
export { SearchField } from './molecules/SearchField';
export type { SearchFieldProps } from './molecules/SearchField';

export { QuickActionCard } from './molecules/QuickActionCard';
export type { QuickActionCardProps } from './molecules/QuickActionCard';

export { EmptyState } from './molecules/EmptyState';
export type { EmptyStateProps } from './molecules/EmptyState';

export { Tooltip } from './molecules/Tooltip';
export type { TooltipPosition, TooltipProps, TooltipVariant } from './molecules/Tooltip';

export { Popover } from './molecules/Popover';
export type { PopoverPosition, PopoverProps } from './molecules/Popover';

export { Toast } from './molecules/Toast';
export type { ToastItem, ToastProps, ToastType } from './molecules/Toast';

export { Stepper } from './molecules/Stepper';
export type { StepItem, StepperOrientation, StepperProps, StepStatus } from './molecules/Stepper';

export { SegmentedControl } from './molecules/SegmentedControl';
export type { SegmentedControlOption, SegmentedControlProps } from './molecules/SegmentedControl';

export { IdBadge } from './molecules/IdBadge';
export type { IdBadgeProps, StoreType } from './molecules/IdBadge';

export { LanguageSwitcher } from './molecules/LanguageSwitcher';
export type { LanguageSwitcherProps, LocaleOption } from './molecules/LanguageSwitcher';

export { MessageComposer } from './molecules/MessageComposer';
export type {
  MessageComposerCancelAction,
  MessageComposerProps,
  MessageComposerSendAction,
  MessageComposerSize,
  MessageComposerSubmitMode,
} from './molecules/MessageComposer';

export { SafeMarkdown } from './molecules/SafeMarkdown';
export type { SafeMarkdownProps } from './molecules/SafeMarkdown';

// Organisms
export { DataTable } from './organisms/DataTable';
export type { ColumnOption, DataTableProps } from './organisms/DataTable';

// Context exports
export { ThemeContext, ThemeProvider, UIContext, UIProvider } from './context';
export type {
  LoadingState,
  MessageState,
  MessageType,
  ShowLoadingOptions,
  ShowMessageOptions,
  ThemeContextValue,
  UIContextValue,
} from './context';

export { ToastContext, ToastProvider, useToastContext } from './context';
export type { ToastContextValue } from './context';

export { MarketplaceContext, MarketplaceProvider, useMarketplaceContext } from './context';
export type { MarketplaceContextValue, MarketplaceProviderProps } from './context';

// Hook exports
export { useIsMobile, useLoading, useMediaQuery, useTheme, useToast, useUI } from './hooks';

// Utility exports
export { formatCompactNumber, formatCurrency, formatDate, formatMicroCurrency, getLocaleConfig } from './utils/format';
