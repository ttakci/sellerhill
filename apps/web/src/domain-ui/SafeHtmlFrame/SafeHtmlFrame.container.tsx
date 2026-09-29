/**
 * Renders untrusted third-party HTML (an eBay system message body can be a
 * full inline-styled e-mail template) inside a sandboxed iframe instead of
 * `dangerouslySetInnerHTML` — the same technique the landing page's template
 * previews use for the same reason: `sandbox="allow-same-origin"` disables
 * every script/form/popup capability (no `allow-scripts`, so inline
 * `onerror=`/`<script>` never runs), while still letting this parent read
 * the frame's own document to size the iframe to its real content height.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { SafeHtmlFrameComponent } from './SafeHtmlFrame.component';
import type { SafeHtmlFrameProps } from './SafeHtmlFrame.types';

const MIN_HEIGHT_PX = 48;

export const SafeHtmlFrame = ({ html, title }: SafeHtmlFrameProps): React.ReactElement => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT_PX);

  const measure = useCallback(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (body) {
      setHeight(Math.max(MIN_HEIGHT_PX, body.scrollHeight));
    }
  }, []);

  useEffect(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (!body || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    // Late-loading images inside the e-mail body grow the layout after `load`.
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-observes once `measure` re-runs on load
  }, [height, measure]);

  return (
    <SafeHtmlFrameComponent html={html} title={title} height={height} onLoad={measure} frameRef={frameRef} />
  );
};

SafeHtmlFrame.displayName = 'SafeHtmlFrame';
