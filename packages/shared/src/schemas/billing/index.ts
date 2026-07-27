// packages/shared/src/schemas/billing/index.ts
//
// Billing foundation (phase 1) — validation schemas.
//
// Dual pattern (mirrors orders/store-settings schemas): backend DTOs use
// class-validator (NestJS request bodies), frontend uses Zod (form
// validation). Both implement the same shared interfaces from
// `@repo/shared` domain/billing.

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { z } from 'zod';

import {
  BILLING_DEFAULT_CURRENCY,
  BILLING_DISABLED,
  BILLING_MICROS_PER_UNIT,
  BILLING_UNLIMITED,
  BillingInterval,
  BillingLimitKey,
} from '../../domain/billing/billing.types';

// ---------------------------------------------------------------------------
// Plan create/update (admin-facing)
// ---------------------------------------------------------------------------

export class BillingPlanPriceInputDto {
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @IsInt()
  @Min(0)
  amountMicros!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  providerPriceId?: string | null;
}

export class BillingPlanLimitInputDto {
  @IsEnum(BillingLimitKey)
  limitKey!: BillingLimitKey;

  @IsInt()
  limitValue!: number;

  @IsOptional()
  @IsString()
  unit?: string | null;
}

export class CreateBillingPlanDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsBoolean()
  isActive!: boolean;

  @IsInt()
  @Min(0)
  displayOrder!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingPlanPriceInputDto)
  prices!: BillingPlanPriceInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingPlanLimitInputDto)
  limits!: BillingPlanLimitInputDto[];
}

export class UpdateBillingPlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingPlanPriceInputDto)
  prices?: BillingPlanPriceInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingPlanLimitInputDto)
  limits?: BillingPlanLimitInputDto[];
}

// ---------------------------------------------------------------------------
// Subscribe / checkout (customer-facing)
// ---------------------------------------------------------------------------

export class SubscribeDto {
  @IsUUID()
  planId!: string;

  @IsEnum(BillingInterval)
  interval!: BillingInterval;
}

// ---------------------------------------------------------------------------
// Webhook inbox query (admin-facing, read-only at phase 1)
// ---------------------------------------------------------------------------

export class BillingWebhookQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

// ---------------------------------------------------------------------------
// Frontend Zod schemas (mirror the DTOs for form validation)
// ---------------------------------------------------------------------------

const microsSchema = z
  .number()
  .int()
  .min(0, 'Amount must be non-negative');

const limitValueSchema = z
  .number()
  .int()
  .refine((v) => v === BILLING_UNLIMITED || v === BILLING_DISABLED || v >= 0, {
    message: 'Limit must be -1 (unlimited), 0 (disabled), or a positive integer',
  });

export const billingPlanPriceSchema = z.object({
  interval: z.nativeEnum(BillingInterval),
  amountMicros: microsSchema,
  currency: z.string().min(3).max(3).default(BILLING_DEFAULT_CURRENCY),
  effectiveFrom: z.string().min(1, 'Effective from is required'),
  effectiveTo: z.string().nullable().optional(),
  providerPriceId: z.string().nullable().optional(),
});

export const billingPlanLimitSchema = z.object({
  limitKey: z.nativeEnum(BillingLimitKey),
  limitValue: limitValueSchema,
  unit: z.string().nullable().optional(),
});

export const createBillingPlanSchema = z.object({
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, digits, or hyphens'),
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  prices: z.array(billingPlanPriceSchema).min(1, 'At least one price is required'),
  limits: z.array(billingPlanLimitSchema),
});

export const updateBillingPlanSchema = createBillingPlanSchema.partial();

export const subscribeSchema = z.object({
  planId: z.string().uuid('Plan id must be a UUID'),
  interval: z.nativeEnum(BillingInterval),
});

export const billingWebhookQuerySchema = z.object({
  provider: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a decimal major-unit amount (e.g. 39.00) to micro-units (39_000_000).
 * Use this at the API boundary before storing money; never store floats.
 */
export function toMicros(amount: number): number {
  return Math.round(amount * BILLING_MICROS_PER_UNIT);
}

/**
 * Convert micro-units (39_000_000) back to a decimal major-unit amount (39.00).
 * Use this for display only — never for storage or arithmetic.
 */
export function fromMicros(micros: number): number {
  return micros / BILLING_MICROS_PER_UNIT;
}

export type CreateBillingPlanFormData = z.infer<typeof createBillingPlanSchema>;
export type UpdateBillingPlanFormData = z.infer<typeof updateBillingPlanSchema>;
export type SubscribeFormData = z.infer<typeof subscribeSchema>;
export type BillingWebhookQueryFormData = z.infer<typeof billingWebhookQuerySchema>;
