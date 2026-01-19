import React from 'react';

export const TabletIcon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
    <line x1="12" x2="12.01" y1="18" y2="18" />
  </svg>
);
