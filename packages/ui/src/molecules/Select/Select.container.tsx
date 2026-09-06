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
  // Last committed position, compared each frame so re-renders only fire
  // while the trigger is actually moving (see the effect below).
  const lastPositionRef = useRef<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  useLayoutEffect(() => {
    if (isOpen && !isMobile && containerRef.current) {
      const ESTIMATED_MENU_HEIGHT = 260;
      let frameId: number;

      const updatePosition = () => {
        if (!containerRef.current) {return;}

        const rect = containerRef.current.getBoundingClientRect();
        const margin = 4;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldFlip = spaceBelow < ESTIMATED_MENU_HEIGHT && spaceAbove > spaceBelow;

        const next = {
          top: shouldFlip
            ? rect.top + window.scrollY - margin
            : rect.bottom + window.scrollY + margin,
          left: rect.left + window.scrollX,
          width: rect.width,
          placement: (shouldFlip ? 'top' : 'bottom') as 'bottom' | 'top',
        };

        const last = lastPositionRef.current;
        // The trigger can still be moving when this opens — most commonly a
        // parent Drawer sliding in via CSS transform (transitions.normal,
        // 300ms). A transform transition fires neither `resize` nor
        // `scroll`, so a one-shot measurement freezes the dropdown at the
        // trigger's mid-animation position while the trigger keeps moving
        // to its resting place. Polling every frame while open — and only
        // committing state when the measured position actually changed —
        // keeps the dropdown glued to the trigger through any such
        // animation/reflow without re-rendering once things settle.
        if (
          !last ||
          last.top !== next.top ||
          last.left !== next.left ||
          last.width !== next.width ||
          last.placement !== next.placement
        ) {
          lastPositionRef.current = next;
          setPlacement(next.placement);
          setDropdownStyle({
            position: 'absolute',
            top: next.top,
            left: next.left,
            width: next.width,
            transform: next.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 9999,
          });
        }

        frameId = requestAnimationFrame(updatePosition);
      };

      updatePosition();

      return () => {
        cancelAnimationFrame(frameId);
        lastPositionRef.current = null;
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
      render={({ field, fieldState: { error: controllerError } }) => {
        const fieldSelectedOption = options.find((opt: SelectOption) => opt.value === field.value);
        const fieldFilteredOptions = options.filter((opt: SelectOption) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <ModernSelectStandalone
            {...standaloneProps}
            {...rest}
            value={field.value}
            onChange={field.onChange}
            selectedOption={fieldSelectedOption}
            filteredOptions={fieldFilteredOptions}
            onSelect={(option: SelectOption) => {
              field.onChange(option.value);
              setIsOpen(false);
              setSearchQuery('');
            }}
            error={controllerError}
          />
        );
      }}
    />
  );
};

Select.displayName = 'Select';
