import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Controller, FieldValues } from 'react-hook-form';

import { Icon } from '../../atoms/Icon';
import * as S from './Select.style';
import type { SelectProps, SelectOption } from './Select.types';

export const ModernSelectStandalone = <TFieldValues extends FieldValues = FieldValues>({
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
  id,
  size = 'medium',
  searchPlaceholder,
  noResultsMessage,
}: Omit<SelectProps<TFieldValues>, 'name' | 'control' | 'rules'>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
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
  const hasValue = !!selectedOption;

  const filteredOptions = options.filter((opt: SelectOption) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const margin = 4;
        
        const absoluteTop = rect.top + window.scrollY;
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

  const renderDropdown = () => {
    if (!isOpen) return null;

    const content = (
      <>
        {isSearchable && (
          <S.SearchWrapper>
            <S.SearchInput
              autoFocus
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </S.SearchWrapper>
        )}
        <S.OptionsList>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option: SelectOption) => (
              <S.OptionItem
                key={option.value}
                $isSelected={value === option.value}
                $isFocused={false}
                onClick={() => handleSelect(option)}
              >
                <S.OptionContent>
                  {option.icon && <Icon name={option.icon} size={18} />}
                  <span>{option.label}</span>
                </S.OptionContent>
                {value === option.value && <Icon name="check" size={18} />}
              </S.OptionItem>
            ))
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8125rem' }}>
              {noResultsMessage}
            </div>
          )}
        </S.OptionsList>
      </>
    );

    if (isMobile) {
      return createPortal(
        <S.Overlay onClick={() => setIsOpen(false)}>
          <S.BottomSheet onClick={(e) => e.stopPropagation()}>
            <S.Handle />
            <S.BottomSheetHeader>
              <S.BottomSheetTitle>{label || placeholder}</S.BottomSheetTitle>
              <S.CloseButton onClick={() => setIsOpen(false)}>
                <Icon name="x" size={20} />
              </S.CloseButton>
            </S.BottomSheetHeader>
            {content}
            <div style={{ height: '2rem', flexShrink: 0 }} /> {/* Safe area spacer */}
          </S.BottomSheet>
        </S.Overlay>,
        document.body
      );
    }

    return createPortal(
      <S.DropdownContainer ref={dropdownRef} style={dropdownStyle} $placement={placement}>
        {content}
      </S.DropdownContainer>,
      document.body
    );
  };

  return (
    <S.Container $fullWidth={fullWidth} ref={containerRef}>
      <S.FieldWrapper
        $isFocused={isOpen}
        $hasError={!!error}
        $isDisabled={!!isDisabled}
        $fullWidth={fullWidth}
        $size={size}
        $hasLabel={!!label}
        onClick={toggleDropdown}
      >
        {iconLeft && (
          <S.DecorationWrapper $side="left" $size={size}>
            <Icon name={iconLeft} size={size === 'small' ? 16 : 20} />
          </S.DecorationWrapper>
        )}

        <S.ValueDisplay $hasIconLeft={!!iconLeft} $hasLabel={!!label} $size={size}>
          {selectedOption ? selectedOption.label : (!label ? placeholder : '')}
        </S.ValueDisplay>

        {label && (
          <S.FloatingLabel
            $isFocused={isOpen}
            $hasValue={hasValue}
            $isDisabled={!!isDisabled}
            $hasIconLeft={!!iconLeft}
            $hasError={!!error}
            $size={size}
          >
            {label}
          </S.FloatingLabel>
        )}

        <S.DecorationWrapper $side="right" $size={size}>
          <Icon name={isOpen ? 'chevron_up' : 'chevron_down'} size={size === 'small' ? 16 : 20} />
        </S.DecorationWrapper>

        {renderDropdown()}
      </S.FieldWrapper>

      {error && <S.ErrorText>{error.message}</S.ErrorText>}
    </S.Container>
  );
};

export const Select = <TFieldValues extends FieldValues = FieldValues>(
  props: SelectProps<TFieldValues>
) => {
  const { name, control, rules, ...rest } = props;

  // Manual usage support
  if (!control) {
    return <ModernSelectStandalone {...(rest as any)} value={(rest as any).value} onChange={(rest as any).onChange} />;
  }

  return (
    <Controller
      name={name as any}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <ModernSelectStandalone {...rest} value={field.value} onChange={field.onChange} error={error} />
      )}
    />
  );
};

Select.displayName = 'Select';
