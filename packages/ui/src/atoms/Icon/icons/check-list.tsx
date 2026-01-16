import React from 'react';

export const CheckListIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
     <path d="M11 6L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
     <path d="M11 12L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
     <path d="M11 18L20 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
     
     {/* Check */}
     <path d="M3 6L4.5 7.5L8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
     
     {/* Cross */}
     <path d="M3 11L7 15M7 11L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0, -1)"/> {/* Adjusted to sit on line */}
     
      {/* Check */}
     <path d="M3 18L4.5 19.5L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
