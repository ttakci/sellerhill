import React from 'react';

export const UnfoldMoreIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({ stroke, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 -960 960 960"
    fill={stroke || 'currentColor'}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z"/>
  </svg>
);
