import { useEffect, useRef } from 'react';

import { TabNavComponent } from './TabNav.component';
import type { TabNavProps } from './TabNav.types';

/**
 * The rail never wraps: on a phone it scrolls sideways. A tab chosen by a
 * deep link can therefore start past the edge, so the selected tab is
 * brought into view whenever the selection changes — by scrolling the rail
 * only, never the page (`scrollIntoView` would also move the page vertically).
 */
export const TabNav: React.FC<TabNavProps> = (props) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { value } = props;

  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) {
      return;
    }
    const active = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!active) {
      return;
    }
    const start = active.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    const end = start + active.offsetWidth;
    if (start < list.scrollLeft) {
      list.scrollLeft = start;
    } else if (end > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = end - list.clientWidth;
    }
  }, [value]);

  return <TabNavComponent {...props} listRef={listRef} />;
};

TabNav.displayName = 'TabNav';
