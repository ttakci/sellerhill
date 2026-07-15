/**
 * Generic eBay placeholder icon
 * (Custom design to avoid copyright issues)
 */
import React from 'react';

export const EbayIcon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <text
      x="12"
      y="16.5"
      fontSize="16"
      fontWeight="bold"
      fontFamily="sans-serif"
      textAnchor="middle"
      fill="currentColor"
      stroke="none"
    >
      e
    </text>
  </svg>
);
