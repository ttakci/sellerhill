/**
 * StarRating — five amber stars (full / half / empty) beside a rating, used by
 * the Product Search card and table. Presentation only: the fills arrive
 * computed (`toStarFills`).
 */
import { Icon } from '@repo/ui';
import React from 'react';

import * as S from './StarRating.style';
import type { StarRatingProps } from './StarRating.types';

const STAR_SIZE = 14;

export const StarRating: React.FC<StarRatingProps> = ({ stars, label }) => (
  <S.Row role="img" aria-label={label}>
    {stars.map((fill, index) => (
      <S.Slot key={index}>
        {fill === 'full' ? (
          <Icon name="star" size={STAR_SIZE} color="semantic.warning" filled />
        ) : (
          <Icon name="star" size={STAR_SIZE} color="semantic.warning" />
        )}
        {fill === 'half' ? (
          <S.HalfLayer>
            <Icon name="star-half" size={STAR_SIZE} color="semantic.warning" filled />
          </S.HalfLayer>
        ) : null}
      </S.Slot>
    ))}
  </S.Row>
);

StarRating.displayName = 'StarRating';
