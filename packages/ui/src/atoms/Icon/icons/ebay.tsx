/**
 * eBay logo icon - Official colorful wordmark
 */
import React from 'react';

export const EbayIcon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
  <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* e - Red */}
    <path
      d="M45.5 15c-20.5 0-35.5 13-35.5 35 0 21.5 14 35 35.5 35 9.5 0 18-2.5 24-7v-18h-21v10.5h9.5v4c-3 2.5-7 3.5-12.5 3.5-14.5 0-23.5-9.5-23.5-27.5s9-27.5 23.5-27.5c6 0 11.5 1.5 16 4.5l5.5-9.5C66 17 57 15 45.5 15z"
      fill="#E53238"
    />
    {/* b - Blue */}
    <path
      d="M105 50.5c0-21-10-35.5-28-35.5-18 0-28 14.5-28 35.5s10 35 28 35c18 0 28-14 28-35zm-44.5 0c0-15.5 5.5-27.5 16.5-27.5s16.5 12 16.5 27.5-5.5 27.5-16.5 27.5-16.5-12-16.5-27.5z"
      fill="#0064D2"
    />
    {/* a - Yellow */}
    <path
      d="M155 15h-10v69h10c21.5 0 33-14.5 33-34.5S176.5 15 155 15zm0 60.5h-6.5V23.5h6.5c15.5 0 24 11.5 24 26s-8.5 26-24 26z"
      fill="#F5AF02"
    />
    {/* y - Green */}
    <path
      d="M210.5 15h-10.5v69h24v-9h-13.5V15zm29 52v-22h19v-8.5h-19V23.5h21V15h-31.5v69h31.5v-9h-21v-8z"
      fill="#86B817"
    />
  </svg>
);
