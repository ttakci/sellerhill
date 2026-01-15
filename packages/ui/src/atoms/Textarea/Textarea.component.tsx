import React, { forwardRef } from 'react';
import * as S from './Textarea.style';
import type { TextareaProps } from './Textarea.types';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ value, onChange, onBlur, placeholder, disabled, hasError, fullWidth = true, rows = 4, name, id, className }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        if (typeof onChange === 'function' && onChange.length === 1 && typeof e.target.value === 'string') {
           // This is a bit tricky with overloaded handlers, but standard RHF pattern works
           (onChange as any)(e);
        } else {
           (onChange as any)(e);
        }
      }
    };

    return (
      <S.StyledTextarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onBlur={onBlur as any}
        placeholder={placeholder}
        disabled={disabled}
        $hasError={hasError}
        $fullWidth={fullWidth}
        rows={rows}
        name={name}
        id={id}
        className={className}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
