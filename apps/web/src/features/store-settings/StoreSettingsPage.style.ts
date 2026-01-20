import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: ${tkn('colors.text.secondary')};
`;

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  box-sizing: border-box;
  padding-bottom: 40px;
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0;

  @media (max-width: 767px) {
    flex-direction: column;
    gap: ${tkn('spacing.md')};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
`;

export const GlobalSettingsCard = styled.div`
  margin-top: 8px;
`;

export const GlobalBanner = styled.div`
  background: #FFFFFF;
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: 16px;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: ${tkn('shadows.sm')};

  @media (max-width: 1023px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
`;

export const SwitchGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const SwitchLabelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const StoreSelectWrapper = styled.div<{ $disabled?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};

  @media (max-width: 1023px) {
    width: 100%;
  }
`;

export const StoreLabel = styled.label`
  font-size: 11px;
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  letter-spacing: 0.05em;
`;

export const GlobalGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
  }

  & .custom-shadow {
    box-shadow: ${tkn('shadows.sm')};
    border-radius: 16px;
    overflow: hidden;
  }
`;

export const SectionHeader = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  align-items: center;
  gap: 16px;
  background: #FFFFFF;
`;

export const HeaderIconWrapper = styled.div<{ $type?: 'location' | 'validation' | 'blacklist' }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${({ $type }) => {
    switch ($type) {
      case 'location':
        return `
          background: #EFF6FF;
          color: #2563EB;
        `;
      case 'validation':
        return `
          background: #F3E8FF;
          color: #9333EA;
        `;
      case 'blacklist':
        return `
          background: #FEF2F2;
          color: #EF4444;
        `;
      default:
        return `
          background: ${tkn('colors.background.tertiary')};
          color: ${tkn('colors.text.primary')};
        `;
    }
  }}
`;

export const SectionTitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
`;

export const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const PaddingContainer = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
`;

export const AddressGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

export const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const InputLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: ${tkn('colors.text.secondary')};
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  background: #FFFFFF;
  color: ${tkn('colors.text.primary')};

  &:focus {
    outline: none;
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`;

export const ValidationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const SwitchItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
`;

export const BlacklistCard = styled(Card)`
  box-shadow: ${tkn('shadows.sm')};
  border-radius: 16px !important;
  overflow: hidden;
`;

export const BlacklistTitleColumn = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
`;

export const BlacklistControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 500px;
  flex: 1;

  @media (max-width: 767px) {
    max-width: 100%;
    margin-top: 12px;
  }
`;

export const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: 10px;
  padding: 4px;
  flex: 1;
  transition: all ${tkn('transitions.fast')};

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  input {
    border: none;
    background: transparent;
    outline: none;
    padding: 6px 12px;
    font-size: 14px;
    flex: 1;
    color: ${tkn('colors.text.primary')};

    &::placeholder {
      color: ${tkn('colors.text.tertiary')};
    }
  }
`;

export const SearchActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const MiniSelect = styled.div`
  width: 120px;
  
  & > div > div {
    height: 32px;
    font-size: 12px;
    background: ${tkn('colors.background.tertiary')};
    border: none;
  }
`;

export const IconAction = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: #FEF2F2;
    color: #EF4444;
  }
`;

export const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
`;

export const FooterLinks = styled.div`
  display: flex;
  gap: 24px;

  a {
    font-size: 11px;
    font-weight: 700;
    color: ${tkn('colors.text.tertiary')};
    text-decoration: none;
    letter-spacing: 0.05em;

    &:hover {
      color: ${tkn('colors.text.secondary')};
    }
  }
`;

export const Copyright = styled.div`
  font-size: 13px;
  color: ${tkn('colors.text.tertiary')};
`;
