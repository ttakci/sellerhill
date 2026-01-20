import React from 'react';

export const BoltIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({ stroke, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 -960 960 960"
    fill={stroke || 'currentColor'}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M320-120v-320H160l360-400v320h160L320-120Z"/>
  </svg>
);
