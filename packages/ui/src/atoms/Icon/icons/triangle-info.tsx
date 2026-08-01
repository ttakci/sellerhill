import React from 'react';

export const TriangleInfoIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({
  stroke = 'currentColor',
  strokeWidth = 2,
  ...props
}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    <path d="M12 10.5v5" />
    <path d="M12 7.5h.01" />
  </svg>
);
