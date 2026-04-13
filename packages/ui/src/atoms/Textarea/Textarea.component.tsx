import { forwardRef } from 'react';

import * as S from './Textarea.style';
import type { TextareaProps } from './Textarea.types';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, fullWidth = true, ...props }, ref) => {
    return (
      <S.Container>
        <S.StyledTextarea
          ref={ref}
          $fullWidth={fullWidth}
          $hasError={!!error}
          {...props}
        />
        {error && <S.HelperText>{error}</S.HelperText>}
      </S.Container>
    );
  }
);

Textarea.displayName = 'Textarea';
