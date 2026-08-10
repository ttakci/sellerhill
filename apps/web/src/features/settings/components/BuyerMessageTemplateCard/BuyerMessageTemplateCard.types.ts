import type { BuyerMessageTemplate } from '@repo/shared';

export interface BuyerMessageTemplateCardProps {
  template: BuyerMessageTemplate;
  /** Localized display label for the template's event type. */
  eventLabel: string;
  /** Shown bottom-left when the template is one of the user's seeded per-event defaults. */
  defaultBadgeLabel: string;
  /** Shown bottom-left (in place of the default badge) for a user-authored template. */
  customBadgeLabel: string;
  /** Called with the template id when the card is clicked or activated by keyboard. */
  onClick: (id: string) => void;
  /** Called with the template id when the delete action is used. */
  onDelete: (id: string) => void;
  deleteLabel: string;
  /** When true, renders the card in its selected (highlighted) state. */
  selected?: boolean;
}
