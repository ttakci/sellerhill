import React from 'react';

import type { IconGlyphProps } from './icon-glyph.types';

export const ZorroIcon = ({
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 3,
}: IconGlyphProps): React.ReactElement => (
  <svg fill={fill} viewBox="0 0 24 24" stroke={stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      d="M4 6h16L4 18h16"
    />
  </svg>
);
