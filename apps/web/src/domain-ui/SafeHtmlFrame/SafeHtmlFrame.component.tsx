import React from 'react';

import * as S from './SafeHtmlFrame.style';
import type { SafeHtmlFrameComponentProps } from './SafeHtmlFrame.types';

export const SafeHtmlFrameComponent = ({
  html,
  title,
  height,
  onLoad,
  frameRef,
}: SafeHtmlFrameComponentProps): React.ReactElement => (
  <S.Frame
    ref={frameRef}
    title={title}
    srcDoc={html}
    sandbox="allow-same-origin"
    loading="lazy"
    onLoad={onLoad}
    $height={height}
  />
);

SafeHtmlFrameComponent.displayName = 'SafeHtmlFrameComponent';
