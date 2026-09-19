import { PlatformSettingType } from '../domain/admin/platform-settings.types';

/**
 * Client-side checks for a platform setting being edited in the admin panel.
 *
 * The server is still the authority (`validateSettingValue` in the API refuses
 * anything out of range). These exist so the operator hears about an obviously
 * wrong value next to the field as they type, instead of after pressing Save
 * and reading a generic error dialog — and so Save can stay disabled for a
 * value that could never be accepted.
 */

export enum PlatformSettingDraftIssue {
  REQUIRED = 'required',
  NOT_A_NUMBER = 'notANumber',
  BELOW_MIN = 'belowMin',
  ABOVE_MAX = 'aboveMax',
}

/** The parts of a setting the draft checks depend on. */
export interface PlatformSettingDraftRules {
  type: PlatformSettingType;
  min: number | null;
  max: number | null;
}

export type PlatformSettingDraftCheck =
  | { valid: true }
  | { valid: false; issue: PlatformSettingDraftIssue; bound?: number };

/**
 * Whether `draft` could be saved for a setting with these rules.
 *
 * Only what is knowable without the server is checked: a value is present, and
 * a NUMBER is finite and inside its bounds. ENUM and cron patterns are left to
 * the API, which owns those grammars.
 */
export function checkPlatformSettingDraft(
  rules: PlatformSettingDraftRules,
  draft: string,
): PlatformSettingDraftCheck {
  const value = draft.trim();
  if (value.length === 0) {
    return { valid: false, issue: PlatformSettingDraftIssue.REQUIRED };
  }
  if (rules.type !== PlatformSettingType.NUMBER) {
    return { valid: true };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { valid: false, issue: PlatformSettingDraftIssue.NOT_A_NUMBER };
  }
  if (rules.min !== null && parsed < rules.min) {
    return { valid: false, issue: PlatformSettingDraftIssue.BELOW_MIN, bound: rules.min };
  }
  if (rules.max !== null && parsed > rules.max) {
    return { valid: false, issue: PlatformSettingDraftIssue.ABOVE_MAX, bound: rules.max };
  }
  return { valid: true };
}

/**
 * Whether the edit differs from what is stored.
 *
 * A secret's stored value is never sent to the browser, so any typed value is a
 * replacement; for everything else, retyping the stored value is not an edit —
 * without this, Save stayed enabled after an edit was typed and then undone.
 */
export function isPlatformSettingDraftDirty(
  stored: string | null,
  draft: string | undefined,
  isSecret: boolean,
): boolean {
  if (draft === undefined) {
    return false;
  }
  if (isSecret) {
    return draft.length > 0;
  }
  return draft !== (stored ?? '');
}
