import React from 'react';

export const ZorroIcon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M4 6h16L4 18h16"
    />
  </svg>
);
