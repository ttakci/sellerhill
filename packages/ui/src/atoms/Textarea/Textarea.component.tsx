import { forwardRef } from 'react';

import * as S from './Textarea.style';
import type { TextareaProps } from './Textarea.types';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, fullWidth = true, fill = false, mono = false, ...props }, ref) => {
    return (
      <S.Container $fill={fill}>
        <S.StyledTextarea
          ref={ref}
          $fullWidth={fullWidth}
          $hasError={!!error}
          $fill={fill}
          $mono={mono}
          {...props}
        />
        {error && <S.HelperText>{error}</S.HelperText>}
      </S.Container>
    );
  }
);

Textarea.displayName = 'Textarea';
