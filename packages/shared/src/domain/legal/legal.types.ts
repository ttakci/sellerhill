/**
 * Legal Document Types
 *
 * Legal documents (privacy policy, and later the terms of service) are stored
 * in the i18n `legal` namespace as STRUCTURED BLOCKS rather than as prose or
 * raw HTML. Three reasons, all of which bit other approaches first:
 *
 * 1. Raw HTML in a translation file cannot be style-tokenised, so a legal page
 *    would be the one surface in the app with hardcoded colours and spacing.
 * 2. Prose split into one key per paragraph loses the list/definition
 *    structure these documents lean on, and a legal list that renders as a
 *    run-on sentence changes what the document appears to say.
 * 3. Blocks make the two locales mechanically comparable: the generator that
 *    writes `en/legal.json` and `tr/legal.json` asserts they have the same
 *    sections, in the same order, with the same block types and list lengths,
 *    before it writes either file. A section silently missing from one locale
 *    (the Turkish draft was originally missing the U.S. state privacy rights
 *    section) is caught there rather than by a reader.
 *
 * The renderer is deliberately total over `LegalBlockType`: an unknown block
 * type renders nothing instead of throwing, so a malformed resource degrades
 * to a shorter document rather than a blank page with a stack trace.
 */

/** Which legal document to render. One entry per document in the namespace. */
export enum LegalDocumentKey {
  PRIVACY = 'privacy',
  TERMS = 'terms',
}

/** The block shapes a legal document is built from. */
export enum LegalBlockType {
  /** A paragraph. */
  PARAGRAPH = 'p',
  /** A subheading inside a section (e.g. "2.1. Account Information"). */
  SUBHEADING = 'h',
  /** An unordered list. */
  UNORDERED_LIST = 'ul',
  /** An ordered list — used where the document itself numbers its items. */
  ORDERED_LIST = 'ol',
  /** Term/description pairs (retention periods, legal bases, recipients). */
  DEFINITION_LIST = 'dl',
  /** A postal address, rendered one line per entry. */
  ADDRESS = 'address',
  /** A contact email address, rendered as a mailto link. */
  EMAIL = 'email',
}

export interface LegalParagraphBlock {
  type: LegalBlockType.PARAGRAPH;
  text: string;
}

export interface LegalSubheadingBlock {
  type: LegalBlockType.SUBHEADING;
  text: string;
}

export interface LegalListBlock {
  type: LegalBlockType.UNORDERED_LIST | LegalBlockType.ORDERED_LIST;
  items: string[];
}

export interface LegalDefinitionItem {
  term: string;
  text: string;
}

export interface LegalDefinitionListBlock {
  type: LegalBlockType.DEFINITION_LIST;
  items: LegalDefinitionItem[];
}

export interface LegalAddressBlock {
  type: LegalBlockType.ADDRESS;
  lines: string[];
}

export interface LegalEmailBlock {
  type: LegalBlockType.EMAIL;
  address: string;
}

export type LegalBlock =
  | LegalParagraphBlock
  | LegalSubheadingBlock
  | LegalListBlock
  | LegalDefinitionListBlock
  | LegalAddressBlock
  | LegalEmailBlock;

export interface LegalSection {
  /** Stable slug, used as the heading's DOM id so a section can be deep-linked. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  documentTitle: string;
  lastUpdated: string;
  /** Paragraphs shown above the numbered sections. */
  intro: string[];
  sections: LegalSection[];
}
