/**
 * Google "G" mark, single-path monochrome (inherits theme color via currentColor).
 * Multicolour fills are blocked by the design-system no-hardcoded-colors rule in
 * packages/ui, so this matches the amazon/ebay brand-icon pattern (currentColor).
 */
import React from 'react';

export const GoogleIcon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    {...props}
  >
    <path d="M12.06 11.05v2.18h5.05c-.2 1.3-1.46 3.82-5.05 3.82-3.04 0-5.52-2.52-5.52-5.62 0-3.1 2.48-5.62 5.52-5.62 1.73 0 2.89.74 3.55 1.37l2.42-2.33C16.78 3.6 14.66 2.7 12.06 2.7 6.98 2.7 2.86 6.82 2.86 11.9S6.98 21.1 12.06 21.1c5.16 0 8.57-3.62 8.57-8.73 0-.59-.06-1.04-.14-1.49l-8.43.17z" />
  </svg>
);
