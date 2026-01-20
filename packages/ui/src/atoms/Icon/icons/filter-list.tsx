import React from 'react';

export const FilterListIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({ stroke, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 -960 960 960"
    fill={stroke || 'currentColor'}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M400-240v-80h160v80H400ZM240-440v-80h480v80H240ZM120-640v-80h720v80H120Z"/>
  </svg>
);
