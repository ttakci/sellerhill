import styled from '@emotion/styled';

/** Five 14px stars touching, the way Amazon draws a rating. */
export const Row = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0;
  line-height: 0;
`;

/** One star slot: an outline star with, for a half star, the filled half laid over it. */
export const Slot = styled.span`
  position: relative;
  display: inline-flex;
`;

export const HalfLayer = styled.span`
  position: absolute;
  inset: 0;
  display: inline-flex;
`;
