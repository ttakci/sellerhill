import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding-bottom: ${tkn('spacing.xxxl')};
`;

export const TwoColGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};

  @media (max-width: 48rem) { /* 768px */
    grid-template-columns: 1fr;
  }
`;

export const ProfileHeroCard = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  align-items: center;
  padding: ${tkn('spacing.lg')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.xl')};
  box-shadow: ${tkn('shadows.sm')};

  /* Same geometry as the two-column grid below so the edit button's hover
     box left edge aligns with the Amazon accounts column left edge. */
  @media (max-width: 48rem) { /* 768px */
    grid-template-columns: 1fr;
  }
`;

export const ProfileHeroLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 0;
`;

export const ProfileHeroRight = styled.button`
  all: unset;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 0;
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.sans')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  transition: background-color ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
    & > svg {
      transform: translateX(0.125rem); /* 2px nudge */
    }
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  & > svg {
    flex-shrink: 0;
    transition: transform 0.18s ease;
  }
`;

export const Avatar = styled.div`
  width: 4rem; /* 64px */
  height: 4rem;
  border-radius: 50%;
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${tkn('typography.fontWeight.bold')};
  font-size: ${tkn('typography.fontSize.xxl')};
  flex-shrink: 0;
`;

export const ProfileHeroInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const AccountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.sm')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */

  &:last-child {
    border-bottom: none;
  }
`;

export const AccountRowInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.md')};

  @media (max-width: 36rem) { /* 576px */
    grid-template-columns: 1fr;
  }
`;

export const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const NotImplementedNotice = styled.div`
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.semanticTint.warning')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.warning')}; /* 1px */
  border-radius: ${tkn('radius.md')};
  margin-bottom: ${tkn('spacing.md')};
  display: flex;
  gap: ${tkn('spacing.sm')};
  align-items: flex-start;
`;
