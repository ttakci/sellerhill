import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import type { NavGroupKey } from './AppLayout.types';

/** Per-browser memory of which sidebar groups the seller folded away. */
const STORAGE_KEY = 'sellerhill.sidebar.closedGroups';

export const NAV_GROUP_KEYS: readonly NavGroupKey[] = [
  'overview',
  'sales',
  'inventory',
  'marketing',
  'discover',
  'configuration',
];

/** Which sidebar group a route belongs to — the group of the page on screen
 *  opens by itself, so the active item is never hidden in a folded group. */
export const navGroupForPath = (path: string): NavGroupKey | null => {
  if (path.startsWith('/dashboard') || path.startsWith('/actions')) {
    return 'overview';
  }
  if (/^\/(orders|messages|returns|cancellations)(\/|$)/.test(path)) {
    return 'sales';
  }
  if (path.startsWith('/listings') || path.startsWith('/products')) {
    return 'inventory';
  }
  if (path.startsWith('/campaigns')) {
    return 'marketing';
  }
  if (path.startsWith('/best-sellers')) {
    return 'discover';
  }
  if (path.startsWith('/billing') || path.startsWith('/settings')) {
    return 'configuration';
  }
  return null;
};

const readClosed = (): NavGroupKey[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? NAV_GROUP_KEYS.filter((key) => parsed.includes(key)) : [];
  } catch {
    return [];
  }
};

const writeClosed = (closed: NavGroupKey[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(closed));
  } catch {
    /* Private window / blocked storage: the fold simply is not remembered. */
  }
};

/**
 * Collapsible sidebar groups. Every group starts open; a click folds it and the
 * choice is remembered per browser. Navigating INTO a folded group opens it
 * again (adjusted during render, not in an effect), so the highlighted item is
 * always visible — the seller can still fold it afterwards.
 */
export function useNavGroups(pathWithoutLocale: string) {
  const [closed, setClosed] = useState<NavGroupKey[]>(readClosed);
  const activeGroup = navGroupForPath(pathWithoutLocale);
  const [lastActiveGroup, setLastActiveGroup] = useState<NavGroupKey | null>(activeGroup);

  if (activeGroup !== lastActiveGroup) {
    setLastActiveGroup(activeGroup);
    if (activeGroup && closed.includes(activeGroup)) {
      const next = closed.filter((key) => key !== activeGroup);
      setClosed(next);
      writeClosed(next);
    }
  }

  const openNavGroups = useMemo(
    () =>
      Object.fromEntries(NAV_GROUP_KEYS.map((key) => [key, !closed.includes(key)])) as Record<NavGroupKey, boolean>,
    [closed]
  );

  const onToggleNavGroup = useCallback((key: NavGroupKey) => {
    setClosed((current) => {
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      writeClosed(next);
      return next;
    });
  }, []);

  const onNavGroupKeyDown = useCallback(
    (key: NavGroupKey, event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggleNavGroup(key);
      }
    },
    [onToggleNavGroup]
  );

  return { openNavGroups, onToggleNavGroup, onNavGroupKeyDown };
}
