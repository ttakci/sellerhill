export interface TawkApi {
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  onLoad?: () => void;
  onChatMinimized?: () => void;
  onChatEnded?: () => void;
  onUnreadCountChanged?: (unreadCount: number) => void;
}

export interface TawkToWidgetProps {
  /** Present only in the seller sidebar. Omitted on the public landing page. */
  sidebarCollapsed?: boolean;
  onLaunch?: () => void;
}

export interface TawkToWidgetComponentProps {
  isSidebarLauncher: boolean;
  sidebarCollapsed: boolean;
  unreadCount: number;
  onOpen: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

export {};
