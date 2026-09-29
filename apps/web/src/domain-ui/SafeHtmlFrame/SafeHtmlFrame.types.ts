import type React from 'react';

export interface SafeHtmlFrameProps {
  /**
   * Raw third-party HTML (e.g. an eBay system message body). Never trusted —
   * rendered inside a sandboxed iframe with scripting disabled, so nothing in
   * it can run.
   */
  html: string;
  title: string;
}

export interface SafeHtmlFrameComponentProps extends SafeHtmlFrameProps {
  height: number;
  onLoad: () => void;
  frameRef: React.RefObject<HTMLIFrameElement>;
}
