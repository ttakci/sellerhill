import { createPortal } from 'react-dom';

import { Icon } from '../../atoms/Icon';

import * as S from './Select.style';
import type { SelectStandaloneComponentProps } from './Select.types';

export const ModernSelectStandalone = ({
  value,
  error,
  label,
  options: _options,
  placeholder,
  iconLeft,
  isDisabled,
  fullWidth = true,
  size = 'medium',
  searchPlaceholder,
  noResultsMessage,
  isOpen,
  searchQuery,
  isMobile,
  dropdownStyle,
  placement,
  selectedOption,
  filteredOptions,
  containerRef,
  dropdownRef,
  onToggleDropdown,
  onSelect,
  onSearchChange,
  onClose,
  isSearchable,
}: SelectStandaloneComponentProps) => {
  const hasValue = !!selectedOption;

  const renderDropdown = () => {
    if (!isOpen) {return null;}

    const searchEl = isSearchable && (
      <S.SearchWrapper>
        <S.SearchInput
          autoFocus
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </S.SearchWrapper>
    );

    if (isMobile) {
      return createPortal(
        <S.Overlay onClick={onClose}>
          <S.BottomSheet onClick={(e) => e.stopPropagation()}>
            <S.Handle />
            <S.BottomSheetHeader>
              <S.BottomSheetTitle>{label || placeholder}</S.BottomSheetTitle>
              <S.CloseButton onClick={onClose}>
                <Icon name="x" size={20} />
              </S.CloseButton>
            </S.BottomSheetHeader>
            {searchEl}
            <S.OptionsList>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <S.MobileOption
                    key={option.value}
                    $isSelected={value === option.value}
                    onClick={() => onSelect(option)}
                  >
                    <S.OptionContent>
                      {option.icon && <Icon name={option.icon} size={20} />}
                      <span>{option.label}</span>
                    </S.OptionContent>
                    {value === option.value && <Icon name="check" size={20} />}
                  </S.MobileOption>
                ))
              ) : (
                <S.NoResultsMessage>
                  {noResultsMessage}
                </S.NoResultsMessage>
              )}
            </S.OptionsList>
            <S.SafeAreaSpacer />
          </S.BottomSheet>
        </S.Overlay>,
        document.body
      );
    }

    return createPortal(
      <S.DropdownContainer
        ref={dropdownRef}
        // eslint-disable-next-line design-system/no-inline-styles -- dynamic dropdown positioning computed at runtime
        style={dropdownStyle}
        $placement={placement}
      >
        {searchEl}
        <S.OptionsList>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <S.OptionItem
                key={option.value}
                $isSelected={value === option.value}
                $isFocused={false}
                onClick={() => onSelect(option)}
              >
                <S.OptionContent>
                  {option.icon && <Icon name={option.icon} size={18} />}
                  <span>{option.label}</span>
                </S.OptionContent>
                {value === option.value && <Icon name="check" size={18} />}
              </S.OptionItem>
            ))
          ) : (
            <S.NoResultsMessage>
              {noResultsMessage}
            </S.NoResultsMessage>
          )}
        </S.OptionsList>
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
        onClick={onToggleDropdown}
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
