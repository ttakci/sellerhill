import React from 'react';

export const FlagUSIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="2" y="4" width="20" height="15" rx="2" fill="white"/>
    <mask id="us-mask" maskUnits="userSpaceOnUse" x="2" y="4" width="20" height="15">
        <rect x="2" y="4" width="20" height="15" rx="2" fill="white"/>
    </mask>
    <g mask="url(#us-mask)">
        <path d="M2.5 4h20v15h-20z" fill="white"/>
        <path d="M2.5 4h20v1.5h-20z" fill="#B22234"/>
        <path d="M2.5 6.5h20v1.5h-20z" fill="#B22234"/>
        <path d="M2.5 9h20v1.5h-20z" fill="#B22234"/>
        <path d="M2.5 11.5h20v1.5h-20z" fill="#B22234"/>
        <path d="M2.5 14h20v1.5h-20z" fill="#B22234"/>
        <path d="M2.5 16.5h20v1.5h-20z" fill="#B22234"/>
        <rect x="2" y="4" width="9" height="8.5" fill="#3C3B6E"/>
    </g>
  </svg>
);
