import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';

import { ModernSelectStandalone } from './Select.component';
import type { SelectOption, SelectProps } from './Select.types';

export const Select = <TFieldValues extends FieldValues = FieldValues>(
  props: SelectProps<TFieldValues>
) => {
  const {
    name,
    control,
    rules,
    value,
    onChange,
    error,
    label,
    options,
    placeholder,
    iconLeft,
    isDisabled,
    fullWidth = true,
    isSearchable,
    id: _id,
    size = 'medium',
    searchPlaceholder,
    noResultsMessage,
    ...rest
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  const selectedOption = options.find((opt: SelectOption) => opt.value === value);

  const filteredOptions = options.filter((opt: SelectOption) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // handleSelect is created per-render so it always closes over the latest
  // `onChange` — whether from user props (manual mode) or field.onChange
  // (Controller mode, where standaloneProps.onChange is overridden below).
  const handleSelect = (option: SelectOption) => {
    onChange?.(option.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const toggleDropdown = () => {
    if (!isDisabled) {
      setIsOpen(!isOpen);
    }
  };

  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');

  useLayoutEffect(() => {
    if (isOpen && !isMobile && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current) {return;}

        const rect = containerRef.current.getBoundingClientRect();
        const margin = 4;

        const absoluteBottom = rect.bottom + window.scrollY;

        setPlacement('bottom');

        setDropdownStyle({
          position: 'absolute',
          top: absoluteBottom + margin,
          left: rect.left + window.scrollX,
          width: rect.width,
          transform: 'none',
          zIndex: 9999,
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, isMobile, options.length]);

  const standaloneProps = {
    value,
    error,
    label,
    options,
    placeholder,
    iconLeft,
    isDisabled,
    fullWidth,
    size,
    searchPlaceholder,
    noResultsMessage,
    isSearchable,
    isOpen,
    searchQuery,
    isMobile,
    dropdownStyle,
    placement,
    selectedOption,
    filteredOptions,
    containerRef,
    dropdownRef,
    onToggleDropdown: toggleDropdown,
    onSelect: handleSelect,
    onSearchChange: setSearchQuery,
    onClose: () => setIsOpen(false),
  };

  // Manual usage support
  if (!control) {
    return <ModernSelectStandalone {...standaloneProps} />;
  }

  return (
    <Controller
      name={name!}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error: controllerError } }) => (
        <ModernSelectStandalone
          {...standaloneProps}
          {...rest}
          value={field.value}
          onChange={field.onChange}
          onSelect={(option: SelectOption) => {
            field.onChange(option.value);
            setIsOpen(false);
            setSearchQuery('');
          }}
          error={controllerError}
        />
      )}
    />
  );
};

Select.displayName = 'Select';
