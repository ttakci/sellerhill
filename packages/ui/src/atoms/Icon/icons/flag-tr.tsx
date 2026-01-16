import React from 'react';

export const FlagTRIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="2" y="4" width="20" height="15" rx="2" fill="#E30A17"/>
    <circle cx="9" cy="11.5" r="4" fill="white"/>
    <circle cx="10" cy="11.5" r="3.2" fill="#E30A17"/>
    <path d="M13.5 11.5 L12.5 12 L13 11 L12.5 10 L13.5 10.5 L14.5 10 L14 11 L14.5 12 Z" fill="white" transform="scale(1.2) translate(-1, -1)"/>
  </svg>
);
