import type { BadgeVariant } from '@repo/ui';
import type React from 'react';

/** One solid badge in the card's top-left row (white ink on a coloured fill). */
export interface SettingsRecordBadge {
  label: string;
  variant: BadgeVariant;
}

/** One label / value pair — no icon; the label column is the only ornament. */
export interface SettingsRecordFact {
  label: string;
  value: React.ReactNode;
  /** `negative` paints the value red (a broken state the seller must see). */
  tone?: 'default' | 'negative';
}

export interface SettingsRecordCardProps {
  /** Solid badges, top-left — status first, then any qualifier. */
  badges?: SettingsRecordBadge[];
  /** Sits at the right end of the badge row (e.g. a delete icon button). */
  badgeRowAction?: React.ReactNode;
  title: string;
  /** One muted line under the title. */
  description?: string;
  facts?: SettingsRecordFact[];
  /**
   * A second label / value column beside `facts` (a settings group's fees);
   * it drops under the first column when the card is too narrow for two.
   */
  secondaryFacts?: SettingsRecordFact[];
  /** A clamped text preview (a message template's body). */
  preview?: string;
  /** A red line under the facts — why the record is broken. */
  notice?: string;
  /** Buttons in the footer strip (left-aligned). */
  actions?: React.ReactNode;
  /** "Detay ›" at the footer's right end; shown only when the card is clickable. */
  detailLabel?: string;
  onClick?: () => void;
  ariaLabel?: string;
  selected?: boolean;
}
