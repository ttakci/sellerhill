import { Badge, Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';

import * as S from './SettingsRecordCard.style';
import type { SettingsRecordCardProps, SettingsRecordFact } from './SettingsRecordCard.types';

/** One label / value list; a plain string value is rendered bold, one line. */
const renderFacts = (facts: SettingsRecordFact[]): React.ReactNode => (
  <S.MetaList>
    {facts.map((fact) => (
      <React.Fragment key={fact.label}>
        <S.MetaLabel>
          <Text variant="body-sm" color="text.secondary">
            {fact.label}
          </Text>
        </S.MetaLabel>
        <S.MetaValue>
          {typeof fact.value === 'string' ? (
            <S.OneLine
              variant="body-sm"
              weight="bold"
              numeric
              color={fact.tone === 'negative' ? 'semantic.error' : 'text.primary'}
            >
              {fact.value}
            </S.OneLine>
          ) : (
            fact.value
          )}
        </S.MetaValue>
      </React.Fragment>
    ))}
  </S.MetaList>
);

/**
 * One settings record (store, buyer account, template, settings group) in the
 * list cards' anatomy. A plain string or node value is rendered bold, like
 * every other card's facts; the footer strip appears only when it has
 * something to carry (actions, or the detail hint of a clickable card).
 */
export const SettingsRecordCard: React.FC<SettingsRecordCardProps> = ({
  badges = [],
  badgeRowAction,
  title,
  description,
  facts = [],
  secondaryFacts = [],
  preview,
  notice,
  actions,
  detailLabel,
  onClick,
  ariaLabel,
  selected = false,
}) => {
  const showDetail = Boolean(detailLabel && onClick);
  const showFooter = Boolean(actions) || showDetail;

  return (
    <S.Wrapper
      variant="elevated"
      $selected={selected}
      $clickable={Boolean(onClick)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      aria-pressed={onClick ? selected : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <S.Top>
        {(badges.length > 0 || badgeRowAction) && (
          <S.BadgeRow>
            {badges.map((badge) => (
              <Badge key={badge.label} variant={badge.variant} size="sm" solid>
                {badge.label}
              </Badge>
            ))}
            {badgeRowAction ? <S.BadgeRowAction>{badgeRowAction}</S.BadgeRowAction> : null}
          </S.BadgeRow>
        )}

        <S.TitleBlock>
          <Tooltip content={title} position="top" variant="dark">
            <S.Title variant="body" weight="bold" color="text.primary">
              {title}
            </S.Title>
          </Tooltip>
          {description ? (
            <S.OneLine variant="body-sm" color="text.secondary">
              {description}
            </S.OneLine>
          ) : null}
        </S.TitleBlock>

        {facts.length > 0 && (
          <S.FactColumns $split={secondaryFacts.length > 0}>
            {renderFacts(facts)}
            {secondaryFacts.length > 0 ? renderFacts(secondaryFacts) : null}
          </S.FactColumns>
        )}

        {preview ? (
          <S.PreviewSlot>
            <Tooltip content={<S.PreviewTooltip>{preview}</S.PreviewTooltip>} position="top" variant="dark">
              <S.Preview variant="body-sm" color="text.primary">
                {preview}
              </S.Preview>
            </Tooltip>
          </S.PreviewSlot>
        ) : null}

        {notice ? (
          <S.Notice>
            <Icon name="alert-triangle" size={14} color="semantic.error" />
            <Text variant="caption" color="semantic.error">
              {notice}
            </Text>
          </S.Notice>
        ) : null}
      </S.Top>

      {showFooter && (
        <S.Footer>
          {actions ? <S.Actions>{actions}</S.Actions> : null}
          {showDetail ? (
            <S.DetailHint>
              <Text variant="caption" weight="semibold" color="brand.primary">
                {detailLabel}
              </Text>
              <Icon name="chevron-right" size={16} color="brand.primary" />
            </S.DetailHint>
          ) : null}
        </S.Footer>
      )}
    </S.Wrapper>
  );
};

SettingsRecordCard.displayName = 'SettingsRecordCard';
