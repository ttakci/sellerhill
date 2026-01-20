import React from 'react';

export const PlayArrowIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({ stroke, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 -960 960 960"
    fill={stroke || 'currentColor'}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z"/>
  </svg>
);
