export interface TawkVisibilityOffset {
  position?: 'br' | 'bl';
  xOffset?: number;
  yOffset?: number;
}

export interface TawkCustomStyle {
  visibility?: {
    desktop?: TawkVisibilityOffset;
    mobile?: TawkVisibilityOffset;
  };
}

export interface TawkApi {
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  onLoad?: () => void;
  onChatMinimized?: () => void;
  onChatEnded?: () => void;
  onUnreadCountChanged?: (unreadCount: number) => void;
  /** Must be set BEFORE the embed script executes to take effect. */
  customStyle?: TawkCustomStyle;
  /** Identifies the visitor to agents in the tawk.to dashboard. */
  setAttributes?: (attributes: Record<string, string>, callback?: (error?: unknown) => void) => void;
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
