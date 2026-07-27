import { Injectable } from '@nestjs/common';
import { AssistantToolName, type AssistantContextPlan, type AssistantToolRequest } from '@repo/shared';

export interface AssistantContextClassifier {
  classify(message: string): Promise<AssistantToolRequest[]>;
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const DESTRUCTIVE = /\b(delete|remove|cancel|update|change|sil|kaldır|iptal|güncelle|değiştir)\b/i;
const DOC = /\b(how|why|help|guide|nasıl|neden|yardım|doküman)\b/i;

@Injectable()
export class AssistantContextRouterService {
  constructor(private readonly classifier?: AssistantContextClassifier) {}

  async plan(message: string): Promise<AssistantContextPlan> {
    const text = message.trim().slice(0, 2_000);
    if (!text || DESTRUCTIVE.test(text)) {return { retrievalRequired: DOC.test(text), tools: [], handoffRecommended: DESTRUCTIVE.test(text) };}
    const id = text.match(UUID)?.[0];
    const tools: AssistantToolRequest[] = [];
    if (/\b(listing|inventory|ilan|stok)\b/i.test(text)) {tools.push({ name: id ? AssistantToolName.LISTING_DETAIL : AssistantToolName.LISTINGS_SUMMARY, resourceId: id });}
    if (/\b(order|purchase|sipariş)\b/i.test(text)) {tools.push({ name: id ? AssistantToolName.ORDER_DETAIL : AssistantToolName.ORDERS_SUMMARY, resourceId: id });}
    if (/\b(dashboard|sales|profit|revenue|satış|kâr|ciro)\b/i.test(text)) {tools.push({ name: AssistantToolName.DASHBOARD_SUMMARY });}
    if (/\b(setting|configuration|tax|ayar|vergi)\b/i.test(text)) {tools.push({ name: AssistantToolName.STORE_SETTINGS_SUMMARY });}
    if (/\b(account|store|setup|hesap|mağaza|kurulum)\b/i.test(text)) {tools.push({ name: AssistantToolName.ACCOUNT_OVERVIEW });}
    if (tools.length) {return { retrievalRequired: DOC.test(text), tools: tools.slice(0, 3), handoffRecommended: false };}
    const classified = this.classifier && text.length <= 500 ? await this.classifier.classify(text) : [];
    const allowlist = new Set(Object.values(AssistantToolName));
    return { retrievalRequired: DOC.test(text), tools: classified.filter((tool) => allowlist.has(tool.name)).slice(0, 2), handoffRecommended: false };
  }
}
