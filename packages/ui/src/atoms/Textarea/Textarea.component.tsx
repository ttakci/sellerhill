import { forwardRef } from 'react';

import { ValidationMessage } from '../../molecules/ValidationMessage';

import * as S from './Textarea.style';
import type { TextareaProps } from './Textarea.types';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, fullWidth = true, fill = false, mono = false, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const errorId = error ? `${id ?? props.name ?? 'textarea'}-error` : undefined;

    return (
      <S.Container $fill={fill}>
        <S.StyledTextarea
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={errorId ?? describedBy}
          $fullWidth={fullWidth}
          $hasError={!!error}
          $fill={fill}
          $mono={mono}
          {...props}
        />
        {error && <ValidationMessage id={errorId}>{error}</ValidationMessage>}
      </S.Container>
    );
  }
);

Textarea.displayName = 'Textarea';
