import React from 'react';

export const GlobeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10a15.3 15.3 0 0 1-4 10a15.3 15.3 0 0 1-4-10a15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
