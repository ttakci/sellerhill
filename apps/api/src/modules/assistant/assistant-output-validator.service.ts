import { Injectable } from '@nestjs/common';

import type { AssistantReference } from './assistant-context.service';

export interface ValidatedAssistantOutput { content: string; citationMarkers: string[]; safe: boolean }
const MARKER = /\[SOURCE:([^\]]+)]/g;
const HIGH_RISK = /\b(password|access[_ -]?token|refresh[_ -]?token|two[_ -]?factor[_ -]?secret|encrypted[_ -]?password|shipping[_ -]?address)\b/i;
const ACTION_CLAIM = /\b(I (deleted|cancelled|updated|changed)|sildim|iptal ettim|güncelledim|değiştirdim)\b/i;

@Injectable()
export class AssistantOutputValidatorService {
  validate(output: string, references: AssistantReference[], retrievalUsed: boolean): ValidatedAssistantOutput {
    const allowed = new Set(references.map((reference) => reference.marker));
    const citationMarkers: string[] = [];
    let content = output.slice(0, 12_000).replace(/<[^>]*>/g, '').replace(/\[([^\]]+)]\((?!\/help\/)[^)]+\)/g, '$1');
    content = content.replace(MARKER, (_match, marker: string) => {
      if (!allowed.has(marker)) {return '';}
      if (!citationMarkers.includes(marker)) {citationMarkers.push(marker);}
      return `[SOURCE:${marker}]`;
    }).trim();
    const safe = Boolean(content) && !HIGH_RISK.test(content) && !ACTION_CLAIM.test(content) && (!retrievalUsed || citationMarkers.length > 0);
    return { content: safe ? content : '', citationMarkers, safe };
  }
}
