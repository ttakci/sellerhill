import React from 'react';

export const ExpandMoreIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({ stroke, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 -960 960 960"
    fill={stroke || 'currentColor'}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/>
  </svg>
);
