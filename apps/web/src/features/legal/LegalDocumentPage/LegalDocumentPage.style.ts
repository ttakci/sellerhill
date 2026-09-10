/**
 * LegalDocumentPage Styles
 *
 * A reading surface, not an app screen: one measured column on a plain ground
 * and a sticky bar carrying only the brand and the language control. The
 * document runs to twenty-nine sections, so the column is capped near 46rem —
 * long legal prose set full-bleed is the fastest way to make someone stop
 * reading it.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Page = styled.div`
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
`;

export const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: ${tkn('zIndex.sticky')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  background: ${tkn('colors.sidebar.background')};
  border-bottom: 1px solid ${tkn('colors.sidebar.divider')};

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  }
`;

/* The logo asset hardcodes white lettering, so its surface must stay dark. */
export const BrandButton = styled.button`
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const BackLink = styled.button`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  gap: ${tkn('spacing.xs')};
  border: none;
  background: none;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.sidebar.textMuted')};
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
    color: ${tkn('colors.sidebar.text')};
  }

  &:focus-visible {
    outline: 2px solid ${tkn('colors.brand.primary')};
    outline-offset: 2px;
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    display: none;
  }
`;

export const LanguageTrigger = styled.div`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.sidebar.text')};
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }
`;

export const Layout = styled.div`
  max-width: 46rem;
  margin: 0 auto;
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.xl')};

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  }
`;

export const Article = styled.article`
  min-width: 0;
`;

export const DocumentHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding-bottom: ${tkn('spacing.lg')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
`;

export const DocumentTitle = styled.div`
  display: flex;
`;

export const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')} 0;
`;

export const Section = styled.section`
  padding-top: ${tkn('spacing.xl')};

  /* An anchored heading must clear the sticky bar, or a deep link lands on it. */
  scroll-margin-top: ${tkn('spacing.xxxl')};
`;

export const SectionHeading = styled.div`
  padding-bottom: ${tkn('spacing.sm')};
  scroll-margin-top: ${tkn('spacing.xxxl')};
`;

export const Blocks = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const SubHeading = styled.div`
  padding-top: ${tkn('spacing.sm')};
`;

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin: 0;
  padding-left: ${tkn('spacing.lg')};
`;

export const OrderedList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin: 0;
  padding-left: ${tkn('spacing.lg')};
`;

export const ListItem = styled.li`
  color: ${tkn('colors.text.secondary')};

  &::marker {
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const DefinitionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const DefinitionItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding-left: ${tkn('spacing.md')};
  border-left: 2px solid ${tkn('colors.border.primary')};
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.secondary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
`;

export const EmailLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  align-self: flex-start;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.surface.secondary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.brand.primary')};
  text-decoration: none;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 2px solid ${tkn('colors.brand.primary')};
    outline-offset: 2px;
  }
`;

export const EmptyState = styled.div`
  padding: ${tkn('spacing.xxl')} 0;
`;

export const Footer = styled.footer`
  padding: ${tkn('spacing.xl')};
  border-top: 1px solid ${tkn('colors.border.primary')};
  text-align: center;
`;
