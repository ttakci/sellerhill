/**
 * Narrows an i18n `returnObjects` payload into a typed LegalDocument.
 *
 * i18next hands back `unknown` for object-valued keys, and a legal page that
 * throws is strictly worse than one that renders a little less: the reader
 * came for the terms they are being asked to accept. So every step here fails
 * soft — a malformed block is dropped, a malformed section is dropped, and a
 * document with no usable sections resolves to `null` so the page can show its
 * own "unavailable" state rather than a blank column or a stack trace.
 *
 * This is also the boundary that keeps `LegalBlockType` honest: a block whose
 * `type` is not in the enum never reaches the renderer, so the renderer's
 * switch can stay total without a runtime default that guesses.
 */

import { LegalBlockType, type LegalBlock, type LegalDocument, type LegalSection } from '@repo/shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const parseBlock = (value: unknown): LegalBlock | null => {
  if (!isRecord(value)) {
    return null;
  }

  switch (value.type) {
    case LegalBlockType.PARAGRAPH:
    case LegalBlockType.SUBHEADING: {
      const text = asNonEmptyString(value.text);
      return text ? { type: value.type, text } : null;
    }

    case LegalBlockType.UNORDERED_LIST:
    case LegalBlockType.ORDERED_LIST: {
      const items = asStringArray(value.items);
      return items.length > 0 ? { type: value.type, items } : null;
    }

    case LegalBlockType.DEFINITION_LIST: {
      const items = Array.isArray(value.items)
        ? value.items.flatMap((entry) => {
            if (!isRecord(entry)) {
              return [];
            }
            const term = asNonEmptyString(entry.term);
            const text = asNonEmptyString(entry.text);
            return term && text ? [{ term, text }] : [];
          })
        : [];
      return items.length > 0 ? { type: LegalBlockType.DEFINITION_LIST, items } : null;
    }

    case LegalBlockType.ADDRESS: {
      const lines = asStringArray(value.lines);
      return lines.length > 0 ? { type: LegalBlockType.ADDRESS, lines } : null;
    }

    case LegalBlockType.EMAIL: {
      const address = asNonEmptyString(value.address);
      return address ? { type: LegalBlockType.EMAIL, address } : null;
    }

    default:
      return null;
  }
};

const parseSection = (value: unknown): LegalSection | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = asNonEmptyString(value.id);
  const heading = asNonEmptyString(value.heading);
  if (!id || !heading) {
    return null;
  }
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.flatMap((block) => {
        const parsed = parseBlock(block);
        return parsed ? [parsed] : [];
      })
    : [];
  return { id, heading, blocks };
};

export const parseLegalDocument = (value: unknown): LegalDocument | null => {
  if (!isRecord(value)) {
    return null;
  }

  const documentTitle = asNonEmptyString(value.documentTitle);
  if (!documentTitle) {
    return null;
  }

  const sections = Array.isArray(value.sections)
    ? value.sections.flatMap((section) => {
        const parsed = parseSection(section);
        return parsed ? [parsed] : [];
      })
    : [];

  if (sections.length === 0) {
    return null;
  }

  return {
    documentTitle,
    lastUpdated: asNonEmptyString(value.lastUpdated) ?? '',
    intro: asStringArray(value.intro),
    sections,
  };
};
