/**
 * The platform VeRO list — brand names refused for every seller who keeps
 * VeRO protection on. Operator-owned (admin console), never shown to sellers.
 */
export interface AdminVeroKeywordDto {
  id: string;
  keyword: string;
  createdAt: string;
}

export interface AdminVeroKeywordListDto {
  items: AdminVeroKeywordDto[];
  total: number;
  page: number;
  limit: number;
}

export interface AddVeroKeywordsRequest {
  /** Brand names; each entry may itself hold several, separated by commas or new lines. */
  keywords: string[];
}

export interface AddVeroKeywordsResult {
  added: number;
  /** Already on the list (whatever the casing) or blank. */
  skipped: number;
}

export const VERO_KEYWORD_MAX_LENGTH = 80;
export const VERO_KEYWORDS_MAX_PER_REQUEST = 2000;
