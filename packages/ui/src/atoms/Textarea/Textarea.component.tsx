import { forwardRef } from 'react';

import { ValidationMessage } from '../../molecules/ValidationMessage';

import * as S from './Textarea.style';
import type { TextareaProps } from './Textarea.types';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      error,
      fullWidth = true,
      fill = false,
      mono = false,
      label,
      autoResize = false,
      id,
      placeholder,
      'aria-describedby': describedBy,
      ...props
    },
    ref
  ) => {
    const errorId = error ? `${id ?? props.name ?? 'textarea'}-error` : undefined;

    const field = (
      <S.StyledTextarea
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={errorId ?? describedBy}
        // A single space keeps `:placeholder-shown` meaningful for the floating label.
        placeholder={label ? (placeholder ?? ' ') : placeholder}
        $fullWidth={fullWidth}
        $hasError={!!error}
        $fill={fill}
        $mono={mono}
        $hasLabel={!!label}
        $autoResize={autoResize}
        {...props}
      />
    );

    return (
      <S.Container $fill={fill}>
        {label ? (
          <S.LabeledWrapper>
            {field}
            <S.FloatingLabel htmlFor={id}>{label}</S.FloatingLabel>
          </S.LabeledWrapper>
        ) : (
          field
        )}
        {error && <ValidationMessage id={errorId}>{error}</ValidationMessage>}
      </S.Container>
    );
  }
);

Textarea.displayName = 'Textarea';
