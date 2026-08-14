import { useCallback, useEffect, useState, type FC } from 'react';
import { useSelector } from 'react-redux';

import { TawkToWidgetComponent } from './TawkToWidget.component';
import type { TawkToWidgetProps } from './TawkToWidget.types';

import { selectCurrentUser } from '@/features/auth/store/authSlice';
import { isDemoMode } from '@/features/demo/demoMode';

const TAWK_SCRIPT_ID = 'tawkto-embed-script';
const propertyId = (import.meta.env.VITE_TAWKTO_PROPERTY_ID as string | undefined)?.trim() ?? '';
const widgetId = (import.meta.env.VITE_TAWKTO_WIDGET_ID as string | undefined)?.trim() ?? '';

/**
 * Only shifts the CLOSED launcher icon's position — tawk.to's own auto-open
 * greeting trigger (if enabled) is dashboard-side (Widget Content/Automation)
 * and is not controllable from here.
 */
const LANDING_WIDGET_STYLE = {
  visibility: {
    desktop: { position: 'br' as const, xOffset: 24, yOffset: 24 },
    mobile: { position: 'br' as const, xOffset: 16, yOffset: 16 },
  },
};

/**
 * Loads tawk.to once. On the public landing page it leaves tawk.to's floating
 * launcher visible; in the seller sidebar it hides that launcher and renders
 * the SellerHill-designed trigger instead.
 */
export const TawkToWidget: FC<TawkToWidgetProps> = ({ sidebarCollapsed, onLaunch }) => {
  const isSidebarLauncher = sidebarCollapsed !== undefined;
  const [unreadCount, setUnreadCount] = useState(0);
  const user = useSelector(selectCurrentUser);

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

  /**
   * Identifies the logged-in seller to agents in the tawk.to dashboard, so a
   * support chat opened from the app sidebar can be tied back to a real
   * SellerHill account instead of showing up as an anonymous visitor.
   * Landing-page visitors are never authenticated, so this only applies to
   * the sidebar launcher.
   */
  const identifyVisitor = useCallback(() => {
    if (!isSidebarLauncher || !user) {
      return;
    }
    window.Tawk_API?.setAttributes?.({
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
    });
  }, [isSidebarLauncher, user]);

  useEffect(() => {
    /*
     * The demo must not reach ANY third party. tawk.to is the only external
     * script the shell loads, and a demo visitor is not a customer with a
     * support case — injecting the embed would put them in a real agent queue
     * and hand tawk.to their IP and page history for a session that is
     * entirely sample data.
     */
    if (!propertyId || !widgetId || isDemoMode()) {
      return;
    }

    const api = window.Tawk_API ?? {};
    window.Tawk_API = api;
    window.Tawk_LoadStart = window.Tawk_LoadStart ?? new Date();

    // Must be assigned before the embed script executes to take effect.
    if (!isSidebarLauncher) {
      api.customStyle = LANDING_WIDGET_STYLE;
    }

    const previousOnLoad = api.onLoad;
    const previousOnChatMinimized = api.onChatMinimized;
    const previousOnChatEnded = api.onChatEnded;
    const previousUnreadHandler = api.onUnreadCountChanged;

    api.onLoad = () => {
      previousOnLoad?.();
      configureApi();
      identifyVisitor();
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
    identifyVisitor();

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
  }, [configureApi, identifyVisitor, isSidebarLauncher]);

  const handleOpen = useCallback(() => {
    onLaunch?.();
    window.Tawk_API?.showWidget?.();
    window.Tawk_API?.maximize?.();
    setUnreadCount(0);
  }, [onLaunch]);

  // No embed was loaded in demo mode, so the launcher would be a dead button.
  if (isDemoMode()) {
    return null;
  }

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
