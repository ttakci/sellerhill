import { useCallback, useEffect, useState, type FC } from 'react';

import { TawkToWidgetComponent } from './TawkToWidget.component';
import type { TawkToWidgetProps } from './TawkToWidget.types';

const TAWK_SCRIPT_ID = 'tawkto-embed-script';
const propertyId = (import.meta.env.VITE_TAWKTO_PROPERTY_ID as string | undefined)?.trim() ?? '';
const widgetId = (import.meta.env.VITE_TAWKTO_WIDGET_ID as string | undefined)?.trim() ?? '';

/**
 * Loads tawk.to once. On the public landing page it leaves tawk.to's floating
 * launcher visible; in the seller sidebar it hides that launcher and renders
 * the Zonds-designed trigger instead.
 */
export const TawkToWidget: FC<TawkToWidgetProps> = ({ sidebarCollapsed, onLaunch }) => {
  const isSidebarLauncher = sidebarCollapsed !== undefined;
  const [unreadCount, setUnreadCount] = useState(0);

  const configureApi = useCallback(() => {
    const api = window.Tawk_API;
    if (!api) {
      return;
    }

    if (isSidebarLauncher) {
      api.hideWidget?.();
    } else {
      api.showWidget?.();
    }
  }, [isSidebarLauncher]);

  useEffect(() => {
    if (!propertyId || !widgetId) {
      return;
    }

    const api = window.Tawk_API ?? {};
    window.Tawk_API = api;
    window.Tawk_LoadStart = window.Tawk_LoadStart ?? new Date();

    const previousOnLoad = api.onLoad;
    const previousOnChatMinimized = api.onChatMinimized;
    const previousOnChatEnded = api.onChatEnded;
    const previousUnreadHandler = api.onUnreadCountChanged;

    api.onLoad = () => {
      previousOnLoad?.();
      configureApi();
    };
    api.onChatMinimized = () => {
      previousOnChatMinimized?.();
      if (isSidebarLauncher) {
        api.hideWidget?.();
      }
    };
    api.onChatEnded = () => {
      previousOnChatEnded?.();
      if (isSidebarLauncher) {
        api.hideWidget?.();
      }
    };
    api.onUnreadCountChanged = (count) => {
      previousUnreadHandler?.(count);
      setUnreadCount(count);
    };

    configureApi();

    if (!document.getElementById(TAWK_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = TAWK_SCRIPT_ID;
      script.async = true;
      script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      document.body.appendChild(script);
    }

    return () => {
      api.onLoad = previousOnLoad;
      api.onChatMinimized = previousOnChatMinimized;
      api.onChatEnded = previousOnChatEnded;
      api.onUnreadCountChanged = previousUnreadHandler;
    };
  }, [configureApi, isSidebarLauncher]);

  const handleOpen = useCallback(() => {
    onLaunch?.();
    window.Tawk_API?.showWidget?.();
    window.Tawk_API?.maximize?.();
    setUnreadCount(0);
  }, [onLaunch]);

  return (
    <TawkToWidgetComponent
      isSidebarLauncher={isSidebarLauncher}
      sidebarCollapsed={sidebarCollapsed ?? false}
      unreadCount={unreadCount}
      onOpen={handleOpen}
    />
  );
};

export default TawkToWidget;
