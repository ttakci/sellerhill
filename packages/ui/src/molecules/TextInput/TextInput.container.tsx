import { useRef, useState } from 'react';
import { Controller, type FieldPath, type FieldValues } from 'react-hook-form';

import { TextInputInner } from './TextInput.component';
import type {
  InnerFieldProps,
  TextInputInnerComponentProps,
  TextInputProps,
} from './TextInput.types';

const TextInputInnerContainer = (
  props: Omit<TextInputInnerComponentProps, 'isFocused' | 'isPasswordVisible' | 'inputRef' | 'hasValue' | 'effectiveType' | 'effectiveIconRight' | 'isPassword' | 'onFocus' | 'onBlurField' | 'onContainerClick' | 'onTogglePasswordVisibility'>
) => {
  // hasValue is omitted from props and computed by TextInputInner itself.
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPassword = props.type === 'password';
  const effectiveType = isPassword ? (isPasswordVisible ? 'text' : 'password') : (props.type || 'text');
  const effectiveIconRight = isPassword ? (isPasswordVisible ? 'eye-off' : 'eye') : props.iconRight;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    void e;
  };

  const handleBlur = () => {
    setIsFocused(false);
    props.field.onBlur();
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <TextInputInner
      {...props}
      isFocused={isFocused}
      isPasswordVisible={isPasswordVisible}
      inputRef={inputRef}
      effectiveType={effectiveType}
      effectiveIconRight={effectiveIconRight}
      isPassword={isPassword}
      onFocus={handleFocus}
      onBlurField={handleBlur}
      onContainerClick={handleContainerClick}
      onTogglePasswordVisibility={togglePasswordVisibility}
    />
  );
};

export const TextInput = <TFieldValues extends FieldValues = FieldValues>(
  props: TextInputProps<TFieldValues>
) => {
  const { name, control, rules, ...rest } = props;

  // Manual usage support
  if (!control) {
    const { value, onChange, onBlur } = props;
    const manualField: InnerFieldProps = {
      name,
      value: value ?? '',
      onChange: (e: unknown) => onChange?.(e as React.ChangeEvent<HTMLInputElement>),
      onBlur: () => onBlur?.({} as React.FocusEvent<HTMLInputElement>),
    };
    return <TextInputInnerContainer {...rest} field={manualField} />;
  }

  return (
    <Controller
      name={name as FieldPath<TFieldValues>}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => {
        const adaptedField: InnerFieldProps = {
          name: field.name,
          value: field.value ?? '',
          onChange: (...args: unknown[]) => field.onChange(...args),
          onBlur: field.onBlur,
        };
        return <TextInputInnerContainer {...rest} field={adaptedField} error={error} />;
      }}
    />
  );
};

TextInput.displayName = 'ModernTextInput';
